# GitHub Repository Setup Guide

## 🚀 Creating the Repository

### Step 1: Create New Repository on GitHub
1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Fill in the details:
   - **Repository name**: `ninefold-studio`
   - **Description**: `Ninefold Studio Landing Page - Research Branch of S² Arts Lab`
   - **Visibility**: Public (for free hosting)
   - **Initialize**: Don't initialize (we have existing files)

### Step 2: Initialize Local Repository
```bash
# Navigate to the project directory
cd "C:\Users\shast\S2\APPs\S2 Ecosystem\ninefold-studio-web"

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Ninefold Studio landing page"

# Add remote origin (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/ninefold-studio.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🌐 Deployment Options

### Option 1: GitHub Pages (Free)
1. Go to repository Settings
2. Scroll to "Pages" section
3. Source: Deploy from a branch
4. Branch: main
5. Folder: / (root)
6. Save
7. Your site will be available at: `https://YOUR_USERNAME.github.io/ninefold-studio`

### Option 2: Vercel (Free)
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your `ninefold-studio` repository
5. Deploy automatically
6. Your site will be available at: `https://ninefold-studio.vercel.app`

### Option 3: Netlify (Free)
1. Go to [netlify.com](https://netlify.com)
2. Sign in with GitHub
3. Click "New site from Git"
4. Choose your `ninefold-studio` repository
5. Deploy settings:
   - Build command: `echo 'Static site - no build required'`
   - Publish directory: `.`
6. Deploy
7. Your site will be available at: `https://ninefold-studio.netlify.app`

## 🔧 Custom Domain Setup

### For GitHub Pages:
1. Add `CNAME` file to repository root:
   ```
   s2artslab.com
   ```
2. Configure DNS records as instructed by GitHub
3. SSL certificate will be auto-generated

### For Vercel:
1. Add domain in Vercel dashboard
2. Update DNS records as instructed
3. SSL certificate auto-generated

### For Netlify:
1. Add domain in Netlify dashboard
2. Update DNS records as instructed
3. SSL certificate auto-generated

## 📝 Repository Structure
```
ninefold-studio/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment
├── index.html                  # Main HTML file
├── styles.css                  # CSS styles
├── script.js                   # JavaScript functionality
├── package.json                # Node.js dependencies
├── vercel.json                 # Vercel configuration
├── netlify.toml                # Netlify configuration
├── _redirects                  # Netlify redirects
├── README.md                   # Project documentation
├── CONTRIBUTING.md             # Contribution guidelines
├── LICENSE                     # MIT License
└── .gitignore                  # Git ignore rules
```

## 🎯 Next Steps

1. **Create the repository** following Step 1 above
2. **Push your code** following Step 2 above
3. **Choose a deployment option** (GitHub Pages recommended for simplicity)
4. **Set up custom domain** if desired
5. **Update README.md** with your actual deployment URLs
6. **Test the deployment** to ensure everything works

## 🔗 Useful Commands

```bash
# Check git status
git status

# Add changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push origin main

# Pull latest changes
git pull origin main

# Create new branch
git checkout -b feature/new-feature

# Switch to main branch
git checkout main
```

## 📞 Support

If you encounter any issues:
1. Check the GitHub Issues tab
2. Review the deployment platform documentation
3. Ensure all files are properly committed and pushed
4. Verify DNS settings for custom domains

Happy deploying! 🚀
