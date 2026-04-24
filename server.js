import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import session from 'express-session';

const app = express();

// Create __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'Public')));
app.set('views', path.join(__dirname, 'Views')); 

app.get('/signup', (req, res) => {
    res.render('user/signup')
});
app.listen(3000, ()=> {
    console.log(`Server Running on http://localhost:3000`)
});