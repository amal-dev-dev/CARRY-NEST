import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import Users from '../Model/userModel.js';
import dotenv from 'dotenv';

dotenv.config();

passport.use(new GoogleStrategy(
{
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"

},

async (accessToken, refreshToken, profile, done) => {

    try {

        const email = profile.emails[0].value;
        let user = await Users.findOne({ email });

        if(user.isBlocked) {
            return done(null, false, {message: "Your account has been blocked by admin"});
        }

        if (!user) {
            user = await Users.create({
                name: profile.displayName,
                email,
                password: null
            });
        }
        return done(null, user);

    } catch (error) {

        console.log(error);
        return done(error, null);
    }
}));

// session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const user = await Users.findById(id);
    done(null, user);
});

export default passport;





