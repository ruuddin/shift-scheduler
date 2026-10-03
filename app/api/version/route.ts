import { NextResponse } from 'next/server'

// Public endpoint reporting which commit is live in this deployment.
// Vercel sets VERCEL_GIT_COMMIT_SHA automatically for git-based deploys.
// Used by the release-branch workflow to confirm a production deployment
// succeeded before cutting a release branch — no Vercel API token needed.
export async function GET() {
  return NextResponse.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
  })
}
