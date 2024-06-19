
const mongoose = require("mongoose");


let userSchema = mongoose.Schema({
    email: String,
    fullname: String,
    username: String,
    password: String,
    profile: {
        type: String,
        default: "placeholder_profile.png"
    },
    posts: [
        { type: mongoose.Schema.Types.ObjectId, ref: "post" }
    ],
    following: [
        {
            type: mongoose.Schema.Types.ObjectId, ref: "user"
        }
    ],
    followers: [
        {
            type: mongoose.Schema.Types.ObjectId, ref: "user"
        }
    ],
    bio: {
        type: String,
        default: ""
    }

});

module.exports = mongoose.model("user", userSchema);