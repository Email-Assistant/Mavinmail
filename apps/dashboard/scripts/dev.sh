#!/bin/bash
# Workaround script to run Next.js dev without Turbopack workspace root issues

# Set environment variable to disable Turbopack
export NEXT_PRIVATE_TURBO=0

# Run Next.js dev
next dev

