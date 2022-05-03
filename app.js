require('dotenv').config();
const express = require('express');
const bodyparser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

// const bcrypt = require('bcryptjs');
// const saltRounds = bcrypt.genSaltSync(10);

// const md5 = require('md5');

// const encrypt = require('mongoose-encryption');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyparser.urlencoded({extended: true}));

app.use(session({
    secret: 'our little secret.',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"] });

const User = new mongoose.model("User", userSchema);

// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user._id);
    // if you use Model.id as your idAttribute maybe you'd want
    // done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/', (req, res) => {
    res.render("home");
})

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app.get('/login', (req, res) => {
    res.render("login");
})

app.get('/register', (req, res) => {
    res.render("register");
});

app.get("/secrets", (req, res) => {
   User.find({"secret": {$ne:null}}, (err, foundUser) => {
       if(err){
           console.log(err);
       }else{
           if(foundUser){
               res.render("secrets", {userWithSecrets: foundUser});
           }
       }
   });
});

app.get("/submit", (req, res) => {
    if(req.isAuthenticated()){
        res.render("submit")
    }else{
        res.redirect("/login");
    }
});

app.post("/submit", (req, res) => {
    const submittedSecret = req.body.secret;

    console.log(req.user.id);
    User.findById(req.user.id, (err, foundUser) => {
        if(err){
            console.log(err);
        }else{
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save();
                res.redirect("/secrets");
            }
        }
    });

});

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
});

app.post('/register', (req, res) => {

    User.register({username: req.body.username}, req.body.password, (err, user) => {
        if(err){
            console.log(err);
            res.redirect("/register");
        }else{
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            }); 
        }
    })

    // const newUser = new User({
    //     email: req.body.username,
    //     password: bcrypt.hashSync(req.body.password, saltRounds)
    // });
    // newUser.save((err) => {
    //     if(!err){
    //         res.render("secrets");
    //     }else{
    //         console.log(err);
    //     }
    // });
});

app.post('/login', (req, res) => {


    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, (err) => {
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            });
        }
    });


    // const username = req.body.username;
    // const password = req.body.password;

    // User.findOne({email: username}, (err, foundUser) => {
    //     if(!err){
    //         if(foundUser){
    //             bcrypt.compare(password, foundUser.password, (err, result) => {
    //                 if(result === true){
    //                     res.render("secrets");
    //                 }
    //             });    
                
    //         }
    //     }else{
    //         console.log(err);
    //     }
    // })
})



app.listen(3000, () => {
    console.log("Server started at port 3000");
})