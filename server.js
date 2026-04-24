import express from 'express';
import path from 'node: path';
import { fileURLToPath } from 'url';

const app = express()



app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/login',(req, res) => {
    res.send('user/login');
});


app.listen(3000, ()=> {
    console.log(`Server Running on http://localhost:3000`)
});