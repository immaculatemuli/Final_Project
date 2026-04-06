import { withCors, admin } from './_utils.js';

const handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { uid, limit = 10 } = req.method === 'GET' ? req.query : req.body || {};

  try {
    const db = admin.firestore();
    let query = db.collection('analyses')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) || 10);

    if (uid) {
      query = query.where('uid', '==', uid);
    }

    const snapshot = await query.get();
    const analyses = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      analyses.push({
        id: doc.id,
        language: data.language,
        filename: data.filename,
        type: data.type || 'code',
        overallScore: data.analysis?.overallScore || 0,
        totalIssues: data.analysis?.summary?.totalIssues || 0,
        createdAt: data.createdAt?.toDate().toISOString() || null,
        repository: data.repository || null
      });
    });

    return res.status(200).json({
      success: true,
      analyses,
      count: analyses.length
    });
  } catch (error) {
    console.error('List analyses error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve analyses',
      details: error.message
    });
  }
};

export default withCors(handler);
