const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function requireAuth(req,res,next){const header=req.headers.authorization||'';const token=header.startsWith('Bearer ')?header.slice(7):null;if(!token)return res.status(401).json({error:'Sign in to do that.'});try{req.user=jwt.verify(token,JWT_SECRET);next();}catch(err){return res.status(401).json({error:'Your session has expired. Sign in again.'});}}
function optionalAuth(req,res,next){const header=req.headers.authorization||'';const token=header.startsWith('Bearer ')?header.slice(7):null;if(token){try{req.user=jwt.verify(token,JWT_SECRET);}catch(err){}}next();}
module.exports={requireAuth,optionalAuth,JWT_SECRET};
