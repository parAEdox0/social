const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/images/user-images/")
    },
    filename: function (req, file, cb) {
        crypto.randomBytes(5, function (err, bytes) {
            const fn = bytes.toString("hex") + Date.now() + path.extname(file.originalname);
            cb(null, fn)
        })
    }
})

const upload = multer({ storage: storage })

module.exports = upload;