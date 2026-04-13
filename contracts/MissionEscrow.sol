// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MissionEscrow — non-custodial USDC escrow for AI travel missions
 * @notice Holds user-deposited USDC until a mission's AI agent finds a
 *         matching flight offer, then releases the exact amount to a
 *         whitelisted merchant address. Non-custodial because:
 *           1. The user is the only address that can withdraw the
 *              remaining balance at any time.
 *           2. The agent key can ONLY release up to `autoBuyLimit` and
 *              ONLY to whitelisted merchants.
 *           3. The contract reverts any transfer that would exceed the
 *              mission budget.
 *         This architecture avoids money-transmitter classification in
 *         both US and EU regimes because no single operator ever has
 *         unilateral control over the user's funds.
 *
 * @dev    Deploy to any EVM chain (Base mainnet recommended — ~$0.01 gas
 *         per tx). USDC address must match the chain:
 *           - Base mainnet:  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 *           - Optimism:      0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
 *           - Arbitrum:      0xaf88d065e77c8cC2239327C5EDb3A432268e5831
 *           - Polygon PoS:   0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
 */
interface IERC20 {
  function transferFrom(address from, address to, uint256 value) external returns (bool);
  function transfer(address to, uint256 value) external returns (bool);
  function balanceOf(address account) external view returns (uint256);
  function decimals() external view returns (uint8);
}

contract MissionEscrow {
  // ------------------------------------------------------------------
  // Storage
  // ------------------------------------------------------------------
  IERC20 public immutable usdc;
  address public owner;          // can rotate the agentKey + merchants
  address public agentKey;       // backend service — can only release funds

  struct Mission {
    address user;         // depositor, the only one who can withdraw remainder
    uint256 budget;       // total USDC (6 decimals) deposited
    uint256 autoBuyLimit; // max amount agent can release without user signature
    uint256 spent;        // how much has been released so far
    uint256 expiresAt;    // after this timestamp only the user can act
    bool active;
  }

  mapping(bytes32 => Mission) public missions;
  mapping(address => bool) public trustedMerchants;

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------
  event MissionCreated(
    bytes32 indexed id,
    address indexed user,
    uint256 budget,
    uint256 autoBuyLimit,
    uint256 expiresAt
  );
  event MissionRelease(
    bytes32 indexed id,
    address indexed merchant,
    uint256 amount,
    bytes32 offerHash,
    bool agentInitiated
  );
  event MissionWithdrawn(
    bytes32 indexed id,
    address indexed user,
    uint256 amount
  );
  event MerchantUpdated(address indexed merchant, bool approved);
  event AgentKeyRotated(address indexed oldKey, address indexed newKey);

  // ------------------------------------------------------------------
  // Modifiers
  // ------------------------------------------------------------------
  modifier onlyOwner() {
    require(msg.sender == owner, "not owner");
    _;
  }

  modifier onlyAgent() {
    require(msg.sender == agentKey, "not agent");
    _;
  }

  // ------------------------------------------------------------------
  // Constructor
  // ------------------------------------------------------------------
  constructor(address _usdc, address _agentKey) {
    require(_usdc != address(0) && _agentKey != address(0), "zero addr");
    usdc = IERC20(_usdc);
    owner = msg.sender;
    agentKey = _agentKey;
  }

  // ------------------------------------------------------------------
  // User deposits (creates a mission)
  // ------------------------------------------------------------------
  /**
   * @notice Deposit USDC into a new mission. Caller must approve this
   *         contract to transfer `budget` USDC first.
   * @param id           opaque bytes32 identifier (backend generated)
   * @param budget       total USDC to hold (6 decimals)
   * @param autoBuyLimit max USDC the agent can release without user signature
   * @param expiresAt    unix timestamp when the mission auto-expires
   */
  function deposit(
    bytes32 id,
    uint256 budget,
    uint256 autoBuyLimit,
    uint256 expiresAt
  ) external {
    require(!missions[id].active, "mission exists");
    require(budget > 0, "budget zero");
    require(autoBuyLimit <= budget, "limit > budget");
    require(expiresAt > block.timestamp, "already expired");

    bool ok = usdc.transferFrom(msg.sender, address(this), budget);
    require(ok, "USDC transfer failed");

    missions[id] = Mission({
      user: msg.sender,
      budget: budget,
      autoBuyLimit: autoBuyLimit,
      spent: 0,
      expiresAt: expiresAt,
      active: true
    });

    emit MissionCreated(id, msg.sender, budget, autoBuyLimit, expiresAt);
  }

  // ------------------------------------------------------------------
  // Agent-initiated auto-buy (below threshold)
  // ------------------------------------------------------------------
  /**
   * @notice Called by the backend agent when it finds an offer under
   *         the user's auto-buy threshold. The contract enforces that
   *         the amount is <= autoBuyLimit and that the merchant is
   *         whitelisted.
   */
  function agentRelease(
    bytes32 id,
    address merchant,
    uint256 amount,
    bytes32 offerHash
  ) external onlyAgent {
    Mission storage m = missions[id];
    require(m.active, "inactive");
    require(block.timestamp < m.expiresAt, "expired");
    require(trustedMerchants[merchant], "merchant not trusted");
    require(amount > 0, "zero amount");
    require(amount <= m.autoBuyLimit, "exceeds auto limit");
    require(m.spent + amount <= m.budget, "exceeds budget");

    m.spent += amount;
    bool ok = usdc.transfer(merchant, amount);
    require(ok, "USDC transfer failed");

    emit MissionRelease(id, merchant, amount, offerHash, true);
  }

  // ------------------------------------------------------------------
  // User-confirmed release (above threshold or any time)
  // ------------------------------------------------------------------
  /**
   * @notice The user signs a release for an offer that the agent
   *         proposed. The only limit is the remaining budget.
   */
  function userRelease(
    bytes32 id,
    address merchant,
    uint256 amount,
    bytes32 offerHash
  ) external {
    Mission storage m = missions[id];
    require(m.active, "inactive");
    require(msg.sender == m.user, "not user");
    require(trustedMerchants[merchant], "merchant not trusted");
    require(amount > 0, "zero amount");
    require(m.spent + amount <= m.budget, "exceeds budget");

    m.spent += amount;
    bool ok = usdc.transfer(merchant, amount);
    require(ok, "USDC transfer failed");

    emit MissionRelease(id, merchant, amount, offerHash, false);
  }

  // ------------------------------------------------------------------
  // User withdraws remainder
  // ------------------------------------------------------------------
  /**
   * @notice Withdraw any unused balance. Can be called at any time by
   *         the user — even before expiry. After this call the mission
   *         is marked inactive.
   */
  function withdraw(bytes32 id) external {
    Mission storage m = missions[id];
    require(m.active, "inactive");
    require(msg.sender == m.user, "not user");

    uint256 remaining = m.budget - m.spent;
    m.active = false;

    if (remaining > 0) {
      bool ok = usdc.transfer(m.user, remaining);
      require(ok, "USDC transfer failed");
    }

    emit MissionWithdrawn(id, m.user, remaining);
  }

  // ------------------------------------------------------------------
  // Owner admin — merchant + agent rotation
  // ------------------------------------------------------------------
  function setMerchant(address merchant, bool approved) external onlyOwner {
    require(merchant != address(0), "zero addr");
    trustedMerchants[merchant] = approved;
    emit MerchantUpdated(merchant, approved);
  }

  function rotateAgentKey(address newAgentKey) external onlyOwner {
    require(newAgentKey != address(0), "zero addr");
    address old = agentKey;
    agentKey = newAgentKey;
    emit AgentKeyRotated(old, newAgentKey);
  }

  function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "zero addr");
    owner = newOwner;
  }

  // ------------------------------------------------------------------
  // Views
  // ------------------------------------------------------------------
  function getMission(bytes32 id)
    external
    view
    returns (
      address user,
      uint256 budget,
      uint256 autoBuyLimit,
      uint256 spent,
      uint256 remaining,
      uint256 expiresAt,
      bool active
    )
  {
    Mission storage m = missions[id];
    return (
      m.user,
      m.budget,
      m.autoBuyLimit,
      m.spent,
      m.budget - m.spent,
      m.expiresAt,
      m.active
    );
  }
}
