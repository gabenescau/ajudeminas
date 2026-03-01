import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";
import { Octokit } from "octokit";
import { glob } from "glob";
import fs from "fs";
import path from "path";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for ZuckPay Proxy
  app.post("/api/pix", async (req, res) => {
    try {
      const { valor, nome, cpf, produto } = req.body;

      const clientId = process.env.ZUCKPAY_CLIENT_ID;
      const clientSecret = process.env.ZUCKPAY_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("Missing ZuckPay credentials");
        return res.status(500).json({ error: "Server misconfiguration: Missing credentials" });
      }

      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await axios.post("https://zuckpay.com.br/conta/v3/pix/qrcode", {
        valor,
        nome,
        cpf,
        produto
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("ZuckPay API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to generate PIX" });
    }
  });

  // --- GitHub OAuth & Integration ---

  // 1. Get Auth URL
  app.get('/api/auth/github/url', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.APP_URL}/auth/callback`;
    
    if (!clientId) {
      return res.status(500).json({ error: "Missing GITHUB_CLIENT_ID" });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo user',
    });

    res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
  });

  // 2. Callback Handler
  app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!code || !clientId || !clientSecret) {
      return res.status(400).send("Missing code or credentials");
    }

    try {
      const response = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }, {
        headers: { Accept: 'application/json' }
      });

      const { access_token } = response.data;

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS', token: '${access_token}' }, '*');
                window.close();
              } else {
                document.body.innerHTML = "Authentication successful. You can close this window.";
              }
            </script>
            <p>Authentication successful. Closing...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("GitHub Auth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // 3. Create Repo & Push Code
  app.post('/api/github/push', async (req, res) => {
    const { token, repoName } = req.body;

    if (!token || !repoName) {
      return res.status(400).json({ error: "Missing token or repoName" });
    }

    const octokit = new Octokit({ auth: token });

    try {
      // Get authenticated user
      const { data: user } = await octokit.rest.users.getAuthenticated();
      
      // Check if repo exists, create if not
      let repo;
      try {
        const { data } = await octokit.rest.repos.get({ owner: user.login, repo: repoName });
        repo = data;
        console.log(`Repo ${repoName} exists.`);
      } catch (e: any) {
        if (e.status === 404) {
          console.log(`Creating repo ${repoName}...`);
          const { data } = await octokit.rest.repos.createForAuthenticatedUser({
            name: repoName,
            private: false, // Default to public, change if needed
            auto_init: true, // Initialize with README to have a main branch
          });
          repo = data;
        } else {
          throw e;
        }
      }

      // Wait a bit for initialization if just created
      // (GitHub API might take a moment to propagate the initial commit)
      
      // Get the default branch (usually 'main')
      const branch = repo.default_branch || 'main';
      
      // Get the latest commit SHA
      let latestCommitSha;
      try {
        const { data: refData } = await octokit.rest.git.getRef({
          owner: user.login,
          repo: repoName,
          ref: `heads/${branch}`,
        });
        latestCommitSha = refData.object.sha;
      } catch (e) {
        // If repo is empty (no commits), we can't get ref. 
        // But we used auto_init=true, so it should have a commit.
        console.error("Error getting ref:", e);
        return res.status(500).json({ error: "Could not get repository reference. Is the repo empty?" });
      }

      // Get the tree of the latest commit
      const { data: commitData } = await octokit.rest.git.getCommit({
        owner: user.login,
        repo: repoName,
        commit_sha: latestCommitSha,
      });
      const baseTreeSha = commitData.tree.sha;

      // Read local files
      const files = await glob("**/*", { 
        ignore: ['node_modules/**', '.git/**', 'dist/**', '.env', '.DS_Store'], 
        nodir: true 
      });

      // Create blobs for each file
      const treeItems = [];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8'); // Assuming text files for simplicity
        // For binary files, we'd need base64 encoding. 
        // Simple check for common text extensions or try/catch utf8 read
        
        // Simplified: treat everything as utf-8 text for this demo, 
        // or skip binary files if read fails.
        try {
            // Create blob
            const { data: blobData } = await octokit.rest.git.createBlob({
                owner: user.login,
                repo: repoName,
                content: content,
                encoding: 'utf-8',
            });
            
            treeItems.push({
                path: file,
                mode: '100644', // file mode
                type: 'blob',
                sha: blobData.sha,
            });
        } catch (err) {
            console.warn(`Skipping file ${file} (likely binary or read error)`);
        }
      }

      if (treeItems.length === 0) {
        return res.json({ message: "No files to push." });
      }

      // Create a new tree
      const { data: newTree } = await octokit.rest.git.createTree({
        owner: user.login,
        repo: repoName,
        base_tree: baseTreeSha,
        tree: treeItems as any,
      });

      // Create a new commit
      const { data: newCommit } = await octokit.rest.git.createCommit({
        owner: user.login,
        repo: repoName,
        message: "Initial commit from AI Studio",
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // Update the reference
      await octokit.rest.git.updateRef({
        owner: user.login,
        repo: repoName,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });

      res.json({ success: true, repoUrl: repo.html_url });

    } catch (error: any) {
      console.error("GitHub Push Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving (if needed, though usually handled by build)
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
