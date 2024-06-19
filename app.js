require("dotenv").config();

const express = require("express");
const app = express();

const bodyParser = require("body-parser")
const mongoose = require("mongoose");
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const upload = require("./config/multerConfig");

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(cookieParser());

mongoose.connect(process.env.MONGO_URL);

function isLoggedIn(req, res, next) {
    if (req.cookies.token === "") res.redirect("/login");
    const userEmail = jwt.verify(req.cookies.token, process.env.SECRET);
    req.data = userEmail;
    next();
};

app.get('/', function (req, res) {
    res.render("register");
});

app.post("/register", async function (req, res) {
    let user = await userModel.findOne({ email: req.body.email });
    if (user) return res.render("error");
    const { email, fullname, username, password } = req.body;
    bcrypt.genSalt(10, function (err, salt) {
        bcrypt.hash(password, salt, async function (err, hash) {
            let createdUser = await userModel.create({
                email,
                fullname,
                username,
                password: hash
            });
            let token = jwt.sign({ email }, process.env.SECRET);
            res.cookie("token", token);
            res.redirect("/profile");
        });
    });
});

app.post("/logout", function (req, res) {
    res.cookie("token", "");
    res.redirect("/login");
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/login", async function (req, res) {
    let user = await userModel.findOne({ email: req.body.email });
    if (!user) return res.render("error");


    bcrypt.compare(req.body.password, user.password, function (err, result) {
        if (result) {
            let token = jwt.sign({ email: user.email }, process.env.SECRET);
            res.cookie("token", token);
            // res.send(posts)
            res.redirect("/profile");
        } else return res.send("wrong password");
    });
});

app.get("/profile", isLoggedIn, async function (req, res) {
    // const userId = req.queries.userId;
    let user = await userModel.findOne({ email: req.data.email });
    let posts = await postModel.find({ user: user._id })
    let query = req.query.from || "NULL"
    res.render("profile", { user, posts, query });
});

app.get("/feed", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email }).populate("posts").populate("following");
    let followingUsers = user.following;
    let allPosts = [];

    user.posts.forEach((post) => {
        allPosts.push({
            likes: post.like,
            _id: post._id,
            post: post.picture,
            date: post.date,
            username: user.username,
            profile: user.profile,
            caption: post.caption
        });
    });


    user = await userModel.findOne({ email: req.data.email }).populate({
        path: "following",
        populate: {
            path: "posts"
        }
    }).exec();

    user.following.forEach((followingUser) => {
        followingUser.posts.forEach((post) => {
            allPosts.push({
                likes: post.like,
                _id: post._id,
                post: post.picture,
                date: post.date,
                username: followingUser.username,
                profile: followingUser.profile,
                caption: post.caption
            });
        });
    });

    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.render("feed", { user, posts: allPosts, followingUsers });

});

app.get("/post", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    res.render("post", { user });
});

app.post("/post", isLoggedIn, upload.single("post_image"), async function (req, res) {

    let user = await userModel.findOne({ email: req.data.email });
    let post = await postModel.create({
        user: user._id,
        picture: req.file.filename,
        caption: req.body.caption
    });
    user.posts.push(post._id);
    await user.save();
    res.redirect("/profile");

});

app.get("/edit", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    res.render("edit", { user });

});

app.post("/edit", isLoggedIn, upload.single("profile_image"), async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let updatedUser = await userModel.findOneAndUpdate({ email: user.email }, { username: req.body.username, bio: req.body.bio });
    user = updatedUser;
    res.redirect("/profile")
});

app.post("/editProfile", isLoggedIn, upload.single("profile_image"), async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let updatedUser = await userModel.findOneAndUpdate({ email: user.email }, { profile: req.file.filename });
    user = updatedUser;
    res.redirect("/profile")
})

app.get("/search", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    const users = await userModel.find({ _id: { $ne: user._id } }).sort({ fullname: 1 });

    res.render("search", { user, users });
});

app.post("/follow/:toFollow", isLoggedIn, async function (req, res) {
    const user = await userModel.findOne({ email: req.data.email });
    const toFollow = await userModel.findOne({ username: req.params.toFollow });
    toFollow.followers.push(user._id);
    await toFollow.save();
    user.following.push(toFollow._id);
    await user.save();
    if (req.query.from) res.redirect(`/profile/${toFollow.username}`);
    else res.redirect("/search");
});

app.post("/unfollow/:toUnfollow", isLoggedIn, async function (req, res) {
    const user = await userModel.findOne({ email: req.data.email });
    const toUnfollow = await userModel.findOne({ username: req.params.toUnfollow });
    user.following.splice(user.following.indexOf(toUnfollow._id), 1);
    await user.save();
    toUnfollow.followers.splice(toUnfollow.followers.indexOf(user._id), 1);
    await toUnfollow.save();
    if (req.query.from) res.redirect(`/profile/${toUnfollow.username}`);
    else res.redirect("/search");
});

app.post("/unfollow/following/:toUnfollow", isLoggedIn, async function (req, res) {
    const user = await userModel.findOne({ email: req.data.email });
    const toUnfollow = await userModel.findOne({ username: req.params.toUnfollow });
    user.following.splice(user.following.indexOf(toUnfollow._id), 1);
    await user.save();
    toUnfollow.followers.splice(toUnfollow.followers.indexOf(user._id), 1);
    await toUnfollow.save();
    res.redirect("/following");
});

app.post("/follow/followers/:toFollow", isLoggedIn, async function (req, res) {
    const user = await userModel.findOne({ email: req.data.email });
    const toFollow = await userModel.findOne({ username: req.params.toFollow });
    toFollow.followers.push(user._id);
    await toFollow.save();
    user.following.push(toFollow._id);
    await user.save();
    res.redirect("/followers");
});

app.get("/following", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email }).populate("following");
    let followingUsers = user.following.sort((a, b) => {
        // Extract the full names from the user objects
        let nameA = a.fullname.toUpperCase(); // Convert names to uppercase for case-insensitive comparison
        let nameB = b.fullname.toUpperCase();

        // Compare the full names
        if (nameA < nameB) {
            return -1; // Name A comes before name B
        } else if (nameA > nameB) {
            return 1; // Name B comes before name A
        } else {
            return 0; // Names are equal
        }
    });
    res.render("following", { user, followingUsers });
});

app.get("/followers", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email }).populate("followers");
    let followers = user.followers.sort((a, b) => {
        // Extract the full names from the user objects
        let nameA = a.fullname.toUpperCase(); // Convert names to uppercase for case-insensitive comparison
        let nameB = b.fullname.toUpperCase();

        // Compare the full names
        if (nameA < nameB) {
            return -1; // Name A comes before name B
        } else if (nameA > nameB) {
            return 1; // Name B comes before name A
        } else {
            return 0; // Names are equal
        }
    });
    res.render("followers", { user, followers });
});

app.get("/profile/:otherUser", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let otherUser = await userModel.findOne({ username: req.params.otherUser });
    let otherUserPosts = await postModel.find({ user: otherUser._id });

    const query = req.query.from || "feed"
    // res.send(query);

    if (user.email === otherUser.email) res.redirect("/profile?from=feed");
    else res.render("otherUsersProfile", { user, otherUser, otherUserPosts, query });

});

app.get("/delete", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let posts = await postModel.find({ user: user._id });

    res.render("deletePosts", { user, posts });
});

app.post("/delete/:postId", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let toDeletePost = await postModel.findOne({ _id: req.params.postId });
    let index = user.posts.indexOf(toDeletePost._id);
    user.posts.splice(index, 1);
    await user.save();
    await postModel.findOneAndDelete({ _id: toDeletePost._id });
    res.redirect("/delete");
});

app.get("/postDetails/:postUsername", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let postUser = await userModel.findOne({ username: req.params.postUsername });
    if (postUser._id === user._id) res.redirect("/profile");
    else res.redirect(`/profile/${postUser.username}`);
});

app.post("/like/:postId", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let post = await postModel.findOne({ _id: req.params.postId });
    post.like.push(user._id);
    await post.save();
    res.redirect("/feed");
});

app.post("/unlike/:postId", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let post = await postModel.findOne({ _id: req.params.postId });
    post.like.splice(post.like.indexOf(user._id), 1);
    await post.save();
    res.redirect("/feed");
});

app.get("/story/:otherUser", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let otherUser = await userModel.findOne({ username: req.params.otherUser });
    res.render("story", { user, otherUser })
});

app.get("/:user/posts", isLoggedIn, async function (req, res) {
    let user = await userModel.findOne({ email: req.data.email });
    let otherUser = await userModel.findOne({ username: req.params.user });
    let posts = await postModel.find({ user: otherUser._id });
    // res.send({ otherUser, posts })
    res.render("userPosts", { user, otherUser, posts })
});




app.listen(process.env.PORT);