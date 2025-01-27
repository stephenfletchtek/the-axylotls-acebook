const Post = require("../models/post");
const User = require("../models/user");
const Resize = require("../middleware/resize");
const fs = require("fs");
const path = require("path");

const PostsController = {
  Like: async (req, res) => {
    const postID = req.body.post;
    const userID = req.session.user._id;
    const post = await Post.findOne({ _id: postID });
    let liked = false;

    const userAlreadyLiked = post.likes.includes(userID);
    if (userAlreadyLiked) {
      const index = post.likes.indexOf(userID);
      post.likes.splice(index, 1);

      liked = true;
    } else {
      post.likes.push(userID);
      liked = false;
    }

    await post.save();
    res.send({ liked: liked, userID: userID });
  },

  Index: (req, res) => {
    renderPosts(req, res, "Whats on your mind?")
  },

  Create: async (req, res) => {
    const message = req.body.message;
    // sharp supported mimetypes
    const sharpTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
      "image/tiff",
      "image/svg",
    ];

    if (message == "" && !req.file) {
      renderPosts(req, res, "Please enter a message or add an image")
    }
    else if (req.file && !sharpTypes.includes(req.file.mimetype)) {
      renderPosts(req, res, "Invalid image file")
    }
    else {
      const obj = {
        message: message,
        user: req.session.user._id,
      };

      if (req.file) {
        // save image
        const imagePath = path.join(__dirname, "../uploads");
        const fileUpload = new Resize(imagePath);
        const filename = await fileUpload.save(req.file);

        // load resized image
        const data = fs.readFileSync(path.join(imagePath, filename));

        obj.img = {
          data: data,
          contentType: req.file.mimetype,
        };
      }

      // create post
      Post.create(obj, (err, post) => {
        if (err) {
          throw err;
        } else {
          post.save((err) => {
            if (err) {
              throw err;
            }
            res.status(201).redirect("/posts");
          });
        }
      });
    }
  },
};


function convertPosts(req, posts) {
  posts.forEach((post) => {
    if (post.likes.includes(req.session.user._id) == true) {
      post._doc.color = "#F47983"
    } else {
      post._doc.color = "gray";
    }

    if (post.user.profilePic.data) {
      // do this because you can't mutate back to the populated user
      post._doc.userImg = post.user.profilePic.data.toString("base64");
    }

    if (post.img.data) {
      // from https://dpwdec.github.io/2020/06/17/store-images-in-mongodb
      post.img.data = post.img.data.toString("base64");
      return post.img.data.toObject();
    }
  });
}

function renderPosts(req, res, message) {
  Post.find()
    .populate("user")
    .populate([
      {
        path: "comments",
        populate: {
          path: "postedBy",
        },
      },
    ])
    .exec((err, posts) => {
      if (err) {
        throw err;
      }

      // convert image data and like button colour per post
      convertPosts(req, posts);

      User.findOne({ _id: req.session.user._id })
        .then((user) => {
          if (user.profilePic.data) {
            user.profilePic.data = user.profilePic.data.toString("base64");
          }

          res.render("posts/index", {
            posts: posts.reverse(),
            title: "Acebook",
            placeholder: message,
            profilePic: user.profilePic,
            firstName: user.firstName,
            userID: user._id,
          });
        });
    });
}

module.exports = PostsController;
