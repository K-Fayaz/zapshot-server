const User = require('../models/User');
const jwt = require('jsonwebtoken');
const SECRET = process.env.SECRET || "thisisasecret";

const callBack = async (req,res) => {
  let userDetails = req.user;
  let query = req.query.state ? JSON.parse(req.query.state) : null;

  let next = query?.next || undefined;
  let plan = query?.plan || undefined;
  let redirect = query?.redirect || undefined;

  // console.log('next:', next);

  let client_url = process.env.CLIENT_REDIRECT_URL;

  let user = await User.findOne({email: userDetails.email });

  if (user) {
    const result = await loginUser(userDetails);
    if (result.success) {
      return res.redirect(`${client_url}/signin?status=true&token=${result.token}&id=${result.id}&success=true${next ? `&next=${next}` : ''}${plan ? `&plan=${plan}` : ''}${redirect ? `&redirect=${redirect}` : ''}`);
    } else {
      return res.redirect(`${client_url}/signin?status=false&message=${result.message}`);
    } 
  }
  else {
    const result = await signupUser(userDetails);
    if (result.success) {
      return res.redirect(`${client_url}/signin?status=true&token=${result.token}&id=${result.id}&success=true${next ? `&next=${next}` : ''}${plan ? `&plan=${plan}` : ''}${redirect ? `&redirect=${redirect}` : ''}`);
    } else {
      return res.redirect(`${client_url}/signin?status=false&message=${result.message}`);
    }
  }
}

const loginUser = async (userDetails) => { 
  try {
    // Check if user exists
    let user = await User.findOne({ email: userDetails.email });
    if (!user) {
      return {
        success: false,
        message: 'user_not_found'
      };
    }

    // Create Token
    let payload = { id: user._id };
    let token = jwt.sign(payload, SECRET, {
      expiresIn: '24h'
    });

    return {
      success: true,
      token,
      id: user._id
    };
  } catch (error) {
    console.error('Google login error:', error);
    return {
      success: false,
      message: 'login_failed'
    };
  }
}

const signupUser = async (userDetails) => { 
  try {
    // Check if user already exists
    let existingUser = await User.findOne({ email: userDetails.email });
    if (existingUser) {
      return {
        success: false,
        message: 'user_exists'
      };
    }

    // Create new user
    const newUser = await User.create({
      username: userDetails.name,
      email: userDetails.email,
      password: '',
      profilePhoto: userDetails.profile || ''
    });

    // Create Token
    let payload = { id: newUser._id };
    let token = jwt.sign(payload, SECRET, {
      expiresIn: '24h'
    });

    return {
      success: true,
      token,
      id: newUser._id
    };
  } catch (error) {
    console.error('Google signup error:', error);
    return {
      success: false,
      message: 'signup_failed'
    };
  }
}

module.exports = {
  callBack
}
