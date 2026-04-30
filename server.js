import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import nocache from 'nocache';
import userRoutes from './Routes/user/userRoutes.js';
import connectDB from './DB/connectDB.js';
import passport from './Config/passport.js';
import authRoutes from './Routes/user/authRoutes.js';

dotenv.config();
console.log(process.env.GOOGLE_CLIENT_ID);
const app = express();
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

app.use(nocache());
app.use(session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);

// Create __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'Public')));
app.set('views', path.join(__dirname, 'Views')); 

connectDB();

app.use('/user',userRoutes);


app.listen(PORT, ()=> {
    console.log(`Server Running on http://localhost:${PORT}`)
});