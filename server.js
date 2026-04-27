import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import session from 'express-session';
import nocache from 'nocache';
import userRoutes from './Routes/user/user.js';

const app = express();

app.use(nocache());
app.use(session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: true,
    cookie:{
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Create __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'Public')));
app.set('views', path.join(__dirname, 'Views')); 

app.use('/user',userRoutes);

app.listen(3000, ()=> {
    console.log(`Server Running on http://localhost:3000`)
});