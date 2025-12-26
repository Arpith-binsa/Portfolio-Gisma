#!/bin/bash

echo "===================================="
echo "CLEAN URLs RESTRUCTURE SCRIPT"
echo "For Portfolio-Gisma Repository"
echo "===================================="
echo ""
echo "Current HTML files found:"
echo "  - blog.html"
echo "  - reviews.html"
echo "  - contact.html"
echo "  - photography/album-1.html"
echo "  - photography/album-2.html"
echo "  - photography/album-3.html"
echo "  - photography/album-4.html"
echo ""
echo "⚠️  WARNING: This will restructure your files!"
echo "   Make sure you have committed your current changes first."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "📁 STEP 1: Creating new directories..."
mkdir -p blog
mkdir -p reviews  
mkdir -p contact
mkdir -p photography/album-1
mkdir -p photography/album-2
mkdir -p photography/album-3
mkdir -p photography/album-4
echo "✅ Directories created!"

echo ""
echo "📦 STEP 2: Moving files to new structure..."

# Main pages
if [ -f "blog.html" ]; then
    cp blog.html blog/index.html
    echo "✅ Copied blog.html → blog/index.html"
fi

if [ -f "reviews.html" ]; then
    cp reviews.html reviews/index.html
    echo "✅ Copied reviews.html → reviews/index.html"
fi

if [ -f "contact.html" ]; then
    cp contact.html contact/index.html
    echo "✅ Copied contact.html → contact/index.html"
fi

# Photography albums
if [ -f "photography/album-1.html" ]; then
    cp photography/album-1.html photography/album-1/index.html
    echo "✅ Copied photography/album-1.html → photography/album-1/index.html"
fi

if [ -f "photography/album-2.html" ]; then
    cp photography/album-2.html photography/album-2/index.html
    echo "✅ Copied photography/album-2.html → photography/album-2/index.html"
fi

if [ -f "photography/album-3.html" ]; then
    cp photography/album-3.html photography/album-3/index.html
    echo "✅ Copied photography/album-3.html → photography/album-3/index.html"
fi

if [ -f "photography/album-4.html" ]; then
    cp photography/album-4.html photography/album-4/index.html
    echo "✅ Copied photography/album-4.html → photography/album-4/index.html"
fi

echo ""
echo "✅ DONE! Files copied to new structure."
echo ""
echo "📂 New structure created:"
echo "  blog/index.html"
echo "  reviews/index.html"
echo "  contact/index.html"
echo "  photography/album-1/index.html"
echo "  photography/album-2/index.html"
echo "  photography/album-3/index.html"
echo "  photography/album-4/index.html"
echo ""
echo "🔍 Verify the new structure:"
ls -la blog/ reviews/ contact/
ls -la photography/album-1/ photography/album-2/ photography/album-3/ photography/album-4/
echo ""
echo "⚠️  NEXT STEPS:"
echo "1. Update all links in HTML files (I can create a script for this)"
echo "2. Test the new structure"
echo "3. Delete old .html files after testing"
echo ""
echo "Want to delete the old .html files now? (y/n)"
read -p "> " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    rm blog.html reviews.html contact.html
    rm photography/album-1.html photography/album-2.html photography/album-3.html photography/album-4.html
    echo "✅ Old .html files deleted!"
else
    echo "ℹ️  Old files kept. You can delete them manually later."
fi

echo ""
echo "✅ ALL DONE!"
