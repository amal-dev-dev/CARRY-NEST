import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import nocache from 'nocache';
import userRoutes from './Routes/userRoutes.js';
import connectDB from './DB/connectDB.js';

const app = express();
app.use(express.urlencoded({ extended: true }));


app.use(nocache());
app.use(session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: true,
}));

// Create __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'Public')));
app.set('views', path.join(__dirname, 'Views')); 

connectDB();

app.use('/user',userRoutes);


app.listen(3000, ()=> {
    console.log(`Server Running on http://localhost:3000`)
});