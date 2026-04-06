import { withCors, axios } from './_utils.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { owner, repo } = req.body || {};
  if (!owner || !repo) return res.status(400).json({ error: 'Missing owner or repo' });

  try {
    const ghHeaders = { 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': 'Intellicode-App' 
    };

    // 1. Fetch repo info
    const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const repoInfoResp = await axios.get(repoUrl, { headers: ghHeaders });
    const repoData = repoInfoResp.data;

    if (repoData.private) {
      return res.status(403).json({ error: 'Cannot browse private repositories.' });
    }

    const defaultBranch = repoData.default_branch || 'main';
    const repoInfo = {
      fullName: repoData.full_name,
      description: repoData.description || '',
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      language: repoData.language || '',
      defaultBranch,
    };

    // 2. Fetch full recursive git tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
    const treeResp = await axios.get(treeUrl, { headers: ghHeaders });
    const treeData = treeResp.data;

    // 3. Build nested structure
    const root = [];
    const dirMap = {};

    const getOrCreateDir = (dirPath) => {
      if (dirMap[dirPath]) return dirMap[dirPath];
      const parts = dirPath.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');
      const node = { name, path: dirPath, type: 'dir', children: [] };
      dirMap[dirPath] = node;
      if (parentPath) {
        const parent = getOrCreateDir(parentPath);
        parent.children.push(node);
      } else {
        root.push(node);
      }
      return node;
    };

    const items = (treeData.tree || [])
      .filter(item => !item.path.includes('node_modules') && !item.path.startsWith('.git'))
      .slice(0, 2000); // safety cap

    for (const item of items) {
      const parts = item.path.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      if (item.type === 'tree') {
        getOrCreateDir(item.path);
      } else if (item.type === 'blob') {
        const fileNode = {
          name,
          path: item.path,
          type: 'file',
          size: item.size,
          download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${item.path}`,
        };
        if (parentPath) {
          const parent = getOrCreateDir(parentPath);
          parent.children.push(fileNode);
        } else {
          root.push(fileNode);
        }
      }
    }

    // Sort: dirs first, then files, alphabetically
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(n => { if (n.children) sortNodes(n.children); });
    };
    sortNodes(root);

    return res.status(200).json({ success: true, tree: root, repoInfo });
  } catch (error) {
    console.error('Repo tree error:', error);
    const status = error.response ? error.response.status : 500;
    const message = error.response?.data?.message || error.message;
    return res.status(status).json({ error: 'Failed to fetch repository tree', details: message });
  }
};

export default withCors(handler);
