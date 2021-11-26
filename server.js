//REQUIRE 

const ejs = require("ejs");
const express = require("express");
const mongoose = require("mongoose");
const randToken = require("rand-token");
const session = require("express-session");
const methodOverride = require("method-override");
const passportLocalMongoose = require("passport-local-mongoose");
const bodyparser = require("body-parser");
const nodemailer = require("nodemailer");
const flash = require("connect-flash");
const passport = require("passport");
const dotenv = require("dotenv").config();

//Models
const User = require("./models/user.js");
const Reset = require("./models/reset.js");
const Receipe = require("./models/receipe.js");
const Ingredient = require("./models/ingredient.js");
const Favourite = require("./models/favourite.js");
const Schedule = require("./models/schedule.js");
const receipe = require("./models/receipe.js");
const ingredient = require("./models/ingredient.js");


//express
const app = express();

//bodyparser
app.use(bodyparser.urlencoded({extended:false}));

//EJS
app.set("view engine","ejs");

//dossier public
app.use(express.static("public"));

//cloudMongoAtlas
mongoose.connect("mongodb+srv://paul-elliot:Atlas1997@cluster0.vgooz.mongodb.net/chef?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

//passport local mongoose
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//initialisation de la session
app.use(session({
    secret: "mysecret",
    resave: false,
    saveUninitialized:false
}));

//initialisation de passport
app.use(passport.initialize());
app.use(passport.session());

//flash
app.use(flash());

app.use(function(req,res,next){
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success")
    next();
});
//methodOverride
app.use(methodOverride('_method'));


//fonction verrification de connexion
function isLoggedIn(req,res,next){
    if(req.isAuthenticated()){
        return next();
    }else{
        req.flash("error","Se connecter avant!");
        res.redirect("/login");
    }
};

//Page d'accueil
app.get("/", function(req,res){
    res.render("index");
});

//Page sign up
app.get("/signup",function(req,res){
    res.render("signup");
});
app.post("/signup",function(req,res){
    const newUser = new User({
        username: req.body.username
    });
    User.register(newUser,req.body.password,function(err,user){
        if(err){
            console.log(err);
            res.render("signup");
        }else{
            passport.authenticate("local")(req,res,function(){
                req.flash("success","Félicitaions")
                res.redirect("/login");
            });
        }
    })
});

//Page login
app.get("/login",function(req,res){
    res.render("login");
});
app.post("/login",function(req,res){
   const user = new User({
       username: req.body.username,
       password: req.body.password
   });
   req.login(user,function(err){
    if(err){
        console.log(err);
        req.flash("error","Une erreur est survenue");
    }else{
        passport.authenticate("local")(req,res,function(){
            req.flash("success","Bienvenue")
            res.redirect("/dashboard");
        });
    }
   });
});


//logout
app.get("/logout", function(req,res){
    req.logout();
    req.flash("success","Vous êtes déconnecté");
    res.redirect("/");
})
//forgot
app.get("/forgot",function(req,res){
    res.render("forgot");
});
app.post("/forgot", function(req,res){
    User.findOne({username: req.body.username},function(err,userFound){
        if(err){
            console.log(err);
            res.redirect("/login")
        }else{
            const token = randToken.generate(16);
            Reset.create({
                username: userFound.username,
                resetPasswordToken: token,
                resetPasswordExpires : Date.now()+ 3600000
            });
            const transporter = nodemailer.createTransport({
                service : 'gmail',
                auth:{
                    user: 'marcheenligne225@gmail.com',
                    pass:process.env.pwd
                }
            });
            const mailOptions={
                from: 'marcheenligne225@gmail.com',
                to: req.body.username,
                subject:'Lien pour réinitialiser ton mot de pass',
                text:'Cliquer ici pour réinitialiser votre mot de pass : http://localhost:3000/reset/'+token
            }
            console.log("prêt");
            transporter.sendMail(mailOptions,function(err,response){
                if(err){
                    console.log(err);
                }else{
                    req.flash("success","Mail envoyé");
                    res.redirect("/login");
                    console.log("Mail envoyé");
                }
            });
        }
    })
});
//reset
app.get("/reset/:token",function(req,res){
    Reset.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    },function (err,obj){
        if(err) {
            req.flash("success","token expiré");
            res.redirect('/login');
        }else {
            res.render('reset', {
                token: req.params.token
            });
        }
    });
});

app.post("/reset/:token", function (req, res) {
    Reset.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    }, function (err,obj){
        if (err) {
            req.flash("success","token expiré");
            res.redirect('/login');
        } else {
            if(req.body.password==req.body.password2) {
                User.findOne({username: obj.username},function(err,user){
                    if(err){
                        console.log(err);
                    }else{
                        user.setPassword(req.body.password,function(err){
                            if(err){
                                console.log(err);
                            }else{
                                user.save();
                                const updatedReset = {
                                    resetPasswordToken: null,
                                    resetPasswordExpires: null
                                }
                                Reset.findOneAndUpdate({resetPasswordToken:
                                req.params.token},updatedReset,function(err,obj1){
                                    if(err){
                                        console.log(err);
                                    }else{
                                        res.redirect("/login");
                                    }
                                });
                                
                            }
                        });
                    }
                });
            }
        }
    });
});

//dashboard
app.get("/dashboard",isLoggedIn,function(req,res){
    res.render("dashboard");
});

//Route de la page receipe
app.get("/dashboard/myreceipes",isLoggedIn,function(req,res){
    Receipe.find({
        user: req.user.id
    },function(err,receipe){
        if(err){
            console.log(err);
        }else{
            res.render("receipe",{receipe: receipe});
        }
    });
});
//new receipe
app.get("/dashboard/newreceipe",isLoggedIn,function(req,res){
    res.render("newreceipe");
});
app.post("/dashboard/newreceipe",function(req,res){
    const newReceipe = {
        name : req.body.receipe,
        image: req.body.logo,
        user: req.user.id
    }
    Receipe.create(newReceipe,function(err, newReceipe){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Nouvelle recette ajoutée");
            res.redirect("/dashboard/myreceipes");
        }
    });
});
//My receipes
app.get("/dashboard/myreceipes/:id",isLoggedIn,function(req,res){
    Receipe.findOne({user:req.user.id,_id:req.params.id},function(err,receipeFound){
        if(err){
            console.log(err);
        }else{
            Ingredient.find({
                user: req.user.id,
                receipe: req.params.id
            }, function(err, ingredientFound){
                if(err){
                    console.log(err);
                }else{
                    res.render("ingredients",{
                        ingredient: ingredientFound,
                        receipe:receipeFound
                    });
                }
            });
        }
    });
});

//delete receipe

app.delete("/dashboard/myreceipes/:id",isLoggedIn,function(req,res){
    Receipe.deleteOne({_id:req.params.id},function(err){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Recette supprimée");
            res.redirect("/dashboard/myreceipes");
        }
    });
});

//Nouvel ingrédient
app.get("/dashboard/myreceipes/:id/newingredient",isLoggedIn,function(req,res){
    Receipe.findById({_id : req.params.id},function(err,found){
        if(err){
            console.log(err);
        }else{
            res.render("newingredient",{receipe:found});
        }
    });
});
app.post("/dashboard/myreceipes/:id",isLoggedIn,function(req,res){
    const newIngredient= {
        name: req.body.name,
        bestDish : req.body.dish,
        user: req.user.id,
        quantity: req.body.quantity,
        receipe: req.params.id
    }
    Ingredient.create(newIngredient, function(err,newIngredient){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Votre ingrédient a été ajouté");
            res.redirect("/dashboard/myreceipes/"+req.params.id);
        }
    });
});

app.delete("/dashboard/myreceipes/:id/:ingredientid",isLoggedIn,function(req,res){
    Ingredient.deleteOne({_id: req.params.ingredientid},function(err){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Votre ingrédient a été supprimé");
            res.redirect("/dashboard/myreceipes/"+req.params.id);
        }
    });
});
app.post("/dashboard/myreceipes/:id/:ingredientid/edit",isLoggedIn, function(req,res){
    Receipe.findOne({user:req.user.id,_id:req.params.id},function(err,receipeFound){
        if(err){
            console.log(err);
        }else{
            Ingredient.findOne({
                _id:req.params.ingredientid,
                receipe: req.params.id
            },function(err,ingredientFound){
                if(err){
                    console.log(err);
                }else{
                    res.render("edit",{
                        ingredient: ingredientFound,
                        receipe:receipeFound
                    });
                }
            });
        }
    });
});
app.put("/dashboard/myreceipes/:id/:ingredientid",isLoggedIn,function(req,res){
    const ingredient_updated= {
        name: req.body.name,
        bestDish : req.body.dish,
        user : req.user.id,
        quantity: req.body.quantity,
        receipe: req.params.id
    }
    Ingredient.findByIdAndUpdate({_id:req.params.ingredientid},ingredient_updated,function(err,updatedIngredient){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Ingrédient mis à jour");
            res.redirect("/dashboard/myreceipes/"+ req.params.id);
        }
    });
});

//favourite
app.get("/dashboard/favourites",isLoggedIn,function(req,res){
    Favourite.find({user:req.user.id},function(err,favouriteFound){
        if(err){
            console.log(err);
        }else{
            res.render("favourites",{favourite: favouriteFound});
        }
    })
});
app.get("/dashboard/favourites/newfavourite",isLoggedIn,function(req,res){
    res.render("newfavourite");
});
app.post("/dashboard/favourites",isLoggedIn,function(req,res){
    const newFavourite= {
        title: req.body.title,
        image : req.body.image,
        user : req.user.id,
        description: req.body.description
    }
    Favourite.create(newFavourite,function(err,newFavourite){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Nouveau favoris");
            res.redirect("/dashboard/favourites");
        }
    });
});

app.delete("/dashboard/favourites/:id",isLoggedIn,function(req,res){
    Favourite.deleteOne({_id:req.params.id}, function(err){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Favoris supprimé");
            res.redirect("/dashboard/favourites");
        }
    });
});
//Schedule
app.get("/dashboard/schedule",isLoggedIn,function(req,res){
    Schedule.find({user:req.user.id},function(err,scheduleFound){
        if(err){
            console.log(err);
        }else{
            res.render("schedule", {schedule: scheduleFound});
        }
    });
});
app.get("/dashboard/schedule/newschedule",isLoggedIn,function(req,res){
    res.render("newSchedule");
})
app.post("/dashboard/schedule",isLoggedIn,function(req,res){
    const newSchedule= {
        Receipename: req.body.receipename,
        user : req.user.id,
        time: req.body.time,
        scheduledate: req.body.scheduleDate
    }
    Schedule.create(newSchedule,function(err,newSchedule){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Nouveau schedule");
            res.redirect("/dashboard/schedule");
        }
    });
});

app.delete("/dashboard/schedule/:id",isLoggedIn,function(req,res){
    Schedule.deleteOne({_id:req.params.id}, function(err){
        if(err){
            console.log(err);
        }else{
            req.flash("success","Schedule supprimé");
            res.redirect("/dashboard/schedule");
        }
    });
});

//ÉCOUTE DU PORT 3000 
app.listen(3000, function(req,res){
    console.log("Tout marche bien")
});