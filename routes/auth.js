const express=require('express');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const {v4:uuid}=require('uuid');
const db=require('../db');
const {JWT_SECRET,requireAuth}=require('../middleware/auth');
const router=express.Router();
function publicUser(user){return{id:user.id,username:user.username,email:user.email,createdAt:user.createdAt};}
router.post('/register',(req,res)=>{const{username,email,password}=req.body||{};if(!username||!email||!password)return res.status(400).json({error:'Username, email, and password are all required.'});if(password.length<6)return res.status(400).json({error:'Password needs to be at least 6 characters.'});if(db.get('users').find({email:email.toLowerCase()}).value())return res.status(409).json({error:'An account with that email already exists.'});if(db.get('users').find({username}).value())return res.status(409).json({error:'That username is already taken.'});const user={id:uuid(),username,email:email.toLowerCase(),passwordHash:bcrypt.hashSync(password,10),createdAt:new Date().toISOString()};db.get('users').push(user).write();const token=jwt.sign({id:user.id,username:user.username,email:user.email},JWT_SECRET,{expiresIn:'7d'});res.status(201).json({token,user:publicUser(user)});});
router.post('/login',(req,res)=>{const{email,password}=req.body||{};if(!email||!password)return res.status(400).json({error:'Email and password are required.'});const user=db.get('users').find({email:email.toLowerCase()}).value();if(!user||!bcrypt.compareSync(password,user.passwordHash))return res.status(401).json({error:'Email or password is incorrect.'});const token=jwt.sign({id:user.id,username:user.username,email:user.email},JWT_SECRET,{expiresIn:'7d'});res.json({token,user:publicUser(user)});});
router.get('/me',requireAuth,(req,res)=>{const user=db.get('users').find({id:req.user.id}).value();if(!user)return res.status(404).json({error:'User not found.'});res.json({user:publicUser(user)});});
module.exports=router;
