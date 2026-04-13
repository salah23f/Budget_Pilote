#!/bin/bash
# Skyvoy - Full deployment script
set -e

echo "🚀 Skyvoy Deployment"
echo "===================="

# 1. Build
echo ""
echo "📦 Building..."
pnpm build

# 2. Add env vars to Vercel (ignore errors if already exist)
echo ""
echo "🔑 Setting environment variables..."
echo "1189cd22afmsh7adfb229e56f665p1938c3jsn9cbae5c666e6" | vercel env add RAPIDAPI_KEY production 2>/dev/null || echo "  RAPIDAPI_KEY already set"
echo "sky-scrapper.p.rapidapi.com" | vercel env add RAPIDAPI_HOST production 2>/dev/null || echo "  RAPIDAPI_HOST already set"
echo "re_b1fbNefN_PaKT5RGPfeHPjcfmHB8P7WAE" | vercel env add RESEND_API_KEY production 2>/dev/null || echo "  RESEND_API_KEY already set"
echo "https://lxgckblgkkkhstakwgnu.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production 2>/dev/null || echo "  SUPABASE_URL already set"
echo "sb_publishable_ujmSII03ERVr_ht0lOUDCw_pNkSN8KB" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production 2>/dev/null || echo "  SUPABASE_ANON_KEY already set"

# 3. Deploy to production
echo ""
echo "🌍 Deploying to production..."
vercel --prod

echo ""
echo "✅ Done! Your site is live at https://faregenie.vercel.app"
echo "📱 Open it on your phone and add to home screen!"
