const express = require("express");
const { register } = require("../controllers/authController");
const { login } = require("../controllers/authController");
const { me, getAllUsers } = require("../controllers/authController");

const router = express.Router();


router.post("/register", register);
router.post("/login", login);

router.get("/me", me);
router.get("/users", getAllUsers);

module.exports = router;