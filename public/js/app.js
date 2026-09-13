// app.js — a small hash-router SPA that talks to the REST API in /api.
(function () {
  "use strict";
  const root = document.getElementById("app-root");
  const nav = document.getElementById("header-nav");
  const toastEl = document.getElementById("toast");

  function getToken() { return localStorage.getItem("blog_token"); }
  function getUser() { const raw = localStorage.getItem("blog_user"); return raw ? JSON.parse(raw) : null; }
  function setSession(token, user) { localStorage.setItem("blog_token", token); localStorage.setItem("blog_user", JSON.stringify(user)); }
  function clearSession() { localStorage.removeItem("blog_token"); localStorage.removeItem("blog_user"); }

  async function api(path, { method = "GET", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch("/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }
  function escapeHtml(s) { return (s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" }); }
  function excerpt(text, len) { const clean = text.replace(/\s+/g," ").trim(); return clean.length > len ? clean.slice(0,len).trim()+"…" : clean; }
  function showToast(msg) { toastEl.textContent=msg; toastEl.classList.add("show"); setTimeout(()=>toastEl.classList.remove("show"),2200); }
  function navigate(hash) { window.location.hash = hash; }

  function renderNav() {
    const user = getUser();
    if (user) {
      nav.innerHTML = `<a href="#/new" class="btn btn-outline">Write a post</a><span class="avatar-chip"><span class="avatar-dot">${escapeHtml(user.username.slice(0,2).toUpperCase())}</span>${escapeHtml(user.username)}</span><button class="nav-link" id="signout-link">Sign out</button>`;
      document.getElementById("signout-link").addEventListener("click",()=>{ clearSession(); renderNav(); navigate("#/"); showToast("Signed out."); });
    } else nav.innerHTML = `<a href="#/login" class="nav-link">Sign in</a><a href="#/register" class="btn btn-accent">Create account</a>`;
  }

  async function viewHome() {
    root.innerHTML=`<div class="page-intro"><h1>Marginalia</h1><p>Notes, essays, and half-formed ideas from people who write things down.</p></div><div id="post-list" class="spinner-row">Loading posts…</div>`;
    try {
      const {posts}=await api("/posts"); const list=document.getElementById("post-list");
      if(!posts.length){ list.innerHTML=`<div class="empty-state"><h3>No posts yet</h3><p>Be the first to write something.</p></div>`; return; }
      list.innerHTML=posts.map(p=>`<article class="post-card"><div class="byline">${escapeHtml(p.author.username)} <span class="sep">·</span> ${fmtDate(p.createdAt)}</div><h2><a href="#/post/${p.id}">${escapeHtml(p.title)}</a></h2><p class="excerpt">${escapeHtml(excerpt(p.content,180))}</p><div class="meta-row">${p.commentCount} comment${p.commentCount===1?"":"s"}</div></article>`).join("");
    } catch(err){ root.innerHTML=`<div class="empty-state"><h3>Couldn't load posts</h3><p>${escapeHtml(err.message)}</p></div>`; }
  }

  async function viewPost(id) {
    root.innerHTML=`<div class="spinner-row">Loading post…</div>`;
    try {
      const {post}=await api("/posts/"+id); const user=getUser(); const isOwner=user&&user.id===post.author.id;
      root.innerHTML=`<article class="post-detail"><div class="byline">By ${escapeHtml(post.author.username)} <span>·</span> ${fmtDate(post.createdAt)}${post.updatedAt!==post.createdAt?" <span>·</span> edited":""}</div><h1>${escapeHtml(post.title)}</h1>${isOwner?`<div class="post-owner-actions"><a href="#/edit/${post.id}" class="btn btn-outline">Edit post</a><button class="btn btn-outline" id="delete-post-btn" style="color:var(--accent);border-color:var(--accent-soft)">Delete</button></div>`:""}<div class="body-text">${escapeHtml(post.content)}</div><section class="comments-section"><h3>${post.comments.length} comment${post.comments.length===1?"":"s"}</h3><div id="comments-list">${post.comments.length?post.comments.map(c=>`<div class="comment"><div class="c-head"><span class="c-author">${escapeHtml(c.author.username)}</span><span class="c-date">${fmtDate(c.createdAt)}</span></div><div class="c-body">${escapeHtml(c.content)}</div>${user&&user.id===c.author.id?`<button class="btn-danger-text delete-comment" data-id="${c.id}">Delete</button>`:""}</div>`).join(""):"<p class=\"muted\">No comments yet.</p>"}</div>${user?`<form class="comment-form" id="comment-form"><textarea name="content" placeholder="Write a comment…" required></textarea><div class="comment-form-actions"><button class="btn btn-accent">Comment</button></div></form>`:`<div class="signin-prompt">Sign in to join the conversation. <a href="#/login">Sign in</a></div>`}</section></article>`;
      if(isOwner) document.getElementById("delete-post-btn").addEventListener("click",async()=>{if(!confirm("Delete this post?"))return;try{await api("/posts/"+id,{method:"DELETE"});showToast("Post deleted.");navigate("#/");}catch(e){showToast(e.message);}});
      document.querySelectorAll(".delete-comment").forEach(btn=>btn.addEventListener("click",async()=>{try{await api(`/posts/${id}/comments/${btn.dataset.id}`,{method:"DELETE"});viewPost(id);}catch(e){showToast(e.message);}}));
      const form=document.getElementById("comment-form"); if(form) form.addEventListener("submit",async e=>{e.preventDefault();const content=form.elements.content.value.trim();if(!content)return;try{await api(`/posts/${id}/comments`,{method:"POST",body:{content}});viewPost(id);}catch(err){showToast(err.message);}});
    } catch(err){root.innerHTML=`<div class="empty-state"><h3>Couldn't load post</h3><p>${escapeHtml(err.message)}</p><a href="#/">Back home</a></div>`;}
  }

  function formView({mode="new",post=null}={}) {
    const editing=mode==="edit"; const user=getUser();
    if(!user){navigate("#/login");return;}
    root.innerHTML=`<div class="form-wrap"><div class="form-card"><div class="form-kicker">${editing?"Edit post":"New post"}</div><h1>${editing?"Refine your idea":"Write something worth reading"}</h1><form id="post-form"><label>Title<input name="title" maxlength="140" value="${escapeHtml(post?.title||"")}" placeholder="A clear, inviting title" required></label><label>Content<textarea name="content" placeholder="Start writing…" required>${escapeHtml(post?.content||"")}</textarea></label><div class="form-actions"><a href="${editing?`#/post/${post.id}`:"#/"}" class="btn btn-text">Cancel</a><button class="btn btn-accent">${editing?"Save changes":"Publish post"}</button></div></form></div></div>`;
    document.getElementById("post-form").addEventListener("submit",async e=>{e.preventDefault();const body={title:e.target.title.value.trim(),content:e.target.content.value.trim()};try{const data=await api(editing?`/posts/${post.id}`:"/posts",{method:editing?"PUT":"POST",body});showToast(editing?"Post updated.":"Post published.");navigate("#/post/"+data.post.id);}catch(err){showToast(err.message);}});
  }

  function authView(mode){
    const register=mode==="register";
    root.innerHTML=`<div class="form-wrap"><div class="form-card auth-card"><div class="form-kicker">${register?"Join Marginalia":"Welcome back"}</div><h1>${register?"Create your account":"Sign in"}</h1><p class="form-lede">${register?"Make a place for your notes, essays, and ideas.":"Pick up where you left off."}</p><form id="auth-form">${register?`<label>Username<input name="username" maxlength="40" autocomplete="username" required></label>`:""}<label>Email<input type="email" name="email" autocomplete="email" required></label><label>Password<input type="password" name="password" autocomplete="${register?"new-password":"current-password"}" required></label><div class="form-actions"><a href="${register?"#/login":"#/register"}" class="btn btn-text">${register?"Already have an account?":"Create an account"}</a><button class="btn btn-accent">${register?"Create account":"Sign in"}</button></div></form></div></div>`;
    document.getElementById("auth-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.target;const body={email:f.email.value.trim(),password:f.password.value};if(register)body.username=f.username.value.trim();try{const data=await api(register?"/auth/register":"/auth/login",{method:"POST",body});setSession(data.token,data.user);renderNav();showToast(register?"Account created.":"Signed in.");navigate("#/");}catch(err){showToast(err.message);}});
  }

  async function router(){
    renderNav(); const hash=location.hash||"#/"; const parts=hash.slice(2).split("/");
    if(parts[0]==="post"&&parts[1])return viewPost(parts[1]);
    if(parts[0]==="new")return formView();
    if(parts[0]==="edit"&&parts[1]){try{const {post}=await api("/posts/"+parts[1]);return formView({mode:"edit",post});}catch(e){return viewHome();}}
    if(parts[0]==="login")return authView("login");
    if(parts[0]==="register")return authView("register");
    return viewHome();
  }
  window.addEventListener("hashchange",router); router();
})();
