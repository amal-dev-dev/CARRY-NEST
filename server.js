import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import methodOverride from 'method-override';
import MongoStore from 'connect-mongo';
import passport from './Config/passport.js';

import connectDB from './DB/connectDB.js';

import userRoutes from './Routes/user/userRoutes.js';
import authRoutes from './Routes/user/authRoutes.js';
import adminRoutes from './Routes/admin/adminRoutes.js';

import { setUser } from './Middleware/setUser.js';
import { cartCount } from './Middleware/cartCount.js';
import { wishlistCount } from './Middleware/wishlistCount.js';

dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

const PORT = process.env.PORT || 3000;


// DATABASE
connectDB();

// USER SESSION

const userSession = session({

    name: "user.sid",

    secret: process.env.USER_SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({

        mongoUrl: process.env.MONGO_URI

    }),

    cookie: {

        secure: false,

        httpOnly: true,

        maxAge: 1000 * 60 * 60 * 24

    }

});


// ADMIN SESSION

const adminSession = session({

    name: "admin.sid",

    secret: process.env.ADMIN_SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({

        mongoUrl: process.env.MONGO_URI

    }),

    cookie: {

        secure: false,

        httpOnly: true,

        maxAge: 1000 * 60 * 60 * 24

    }

});


// CACHE CONTROL

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


// PASSPORT


app.use(passport.initialize());


// app.use(passport.session());

// VIEW ENGINE

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "Views"));

app.use(express.static(path.join(__dirname, "Public")));


// HOME

app.get("/", (req, res) => {

    res.redirect("/user/home");

});


// USER ROUTES

app.use("/user",userSession, setUser, cartCount, wishlistCount, userRoutes);

// GOOGLE AUTH ROUTES

app.use("/auth", userSession, authRoutes);

// ADMIN ROUTES

app.use("/admin", adminSession, adminRoutes);

// ERROR HANDLER

app.use((err, req, res, next) => {

    console.log("ERROR:");

    console.log(err);

    res.status(500).send(err.message);

});


// SERVER

app.listen(PORT, () => {

    console.log(`Server Running on http://localhost:${PORT}`);

});  