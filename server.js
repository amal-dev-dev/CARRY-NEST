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
import adminRoutes from "./Routes/admin/adminRoutes.js";
import methodOverride from "method-override";
import { setUser } from "./Middleware/setUser.js";
import MongoStore from "connect-mongo";


dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(methodOverride("_method"));

const PORT = process.env.PORT || 3000;

app.use(session({
    secret: process.env.SESSION_SECRET || "yourSecretKey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI
    }),
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

app.use((req, res, next) => {

    res.setHeader(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
    );
    res.setHeader(
        "Pragma",
        "no-cache"
    );
    res.setHeader(
        "Expires",
        "0"
    );

    next();

});

app.use(setUser);

app.use(passport.initialize());
app.use(passport.session());


// Create __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'Public')));
app.set('views', path.join(__dirname, 'Views')); 

connectDB();

app.use('/user',userRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

app.use((err, req, res, next) => {

    console.log("GOOGLE ERROR:");

    console.log(err);

    res.send(err.message);

});

app.listen(PORT, ()=> {
    console.log(`Server Running on http://localhost:${PORT}`)
});