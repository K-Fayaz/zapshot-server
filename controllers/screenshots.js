const User = require("../models/User");

const { 
  scrapePeerlistPost, 
  extractPeerlistPostData,
  extractPeerlistProfileData 
} = require("../helpers/Peerlist.scraper");

const {
  scrapeTweet,
  scrapeTweetProfile,
  extractTweetDataNew,
  extractTwitterProfileData
} = require("../helpers/Twitter.scraper");

const {
  scrapeThreadsPosts,
  scrapeThreadsProfile,
  extractThreadsPostsData,
  extractThreadsProfileData
} = require("../helpers/Threads.scraper");

const {
  getRedditPostJSON,
  extractaDataFromJson
} = require("../helpers/Reddit.scraper");

const {
  scrapeYouTubePage,
  extractYoutubeVideo,
  extractYoutubeChannelData
} = require("../helpers/Youtube.scraper");

const {
  getProductHuntLaunchDetails,
} = require("../helpers/ProductHunt");

const {
  scrapeInstagramPost,
  extractIgPostData,
  scrapeInstagramProfile,
  scrapeInstagramProfileHTML,
  passMountDivContent
} = require("../helpers/Instagram.scraper");

const getDetails = async (req, res) => {
    try {
      const { url,userId } = req.query;

      if (!url) {
        return res.status(400).json({ error: "Missing tweet URL" });
      }
  
      let html;
      let data;
      let type;
  
      let platform = url.split('/')[2];
      console.log(platform);
      
      if (platform.includes('x.com')) {
        if (url.includes('/status/')) {
          type="post";
          html = await scrapeTweet(url);
          data = extractTweetDataNew(html);
          // console.log(html)
        } else {
          type="profile";
          html = await scrapeTweetProfile(url);
          data = extractTwitterProfileData(html);
          // console.log(data);
        }
      }
      else if (platform.includes('peerlist.io')) {
        
        html = await scrapePeerlistPost(url);

        if (url.includes('peerlist.io/scroll')) {
          data = extractPeerlistPostData(html);
          type="post";
        } else {
          data = extractPeerlistProfileData(html);
          type="profile";
        }
      } 
      else if (platform.includes('threads.com')) {
        if (url.includes('/post')) {
          type="post";
          html = await scrapeThreadsPosts(url);
          data = await extractThreadsPostsData(html,url);
        } else {
          type = "profile";
          html = await scrapeThreadsProfile(url);
          data = await extractThreadsProfileData(html,url);
        } 
      } else if (platform.includes('reddit.com')) {
        let jsonData = await getRedditPostJSON(url);
        let data = await extractaDataFromJson(jsonData,url);

        return res.status(200).json({
          status: true,
          platform,
          data,
        });
      }
      else if (platform.includes('youtu.be') || platform.includes('youtube.com')) {
        platform = "youtube";
        if (url.includes('/channel') || url.includes('/@')) {
          console.log("this is a youtube chanel")
          type = "profile";
          html = await scrapeYouTubePage(url);
          data = await extractYoutubeChannelData(html);
        } else {
          type = "post";
          html = await scrapeYouTubePage(url);
          data = await extractYoutubeVideo(html);
        }
      }
      else if (platform.includes('www.producthunt.com') || platform.includes('producthunt.com')){
        data = await getProductHuntLaunchDetails(url);
        // console.log(data);
      }
      else if (platform.includes('www.instagram.com') || platform.includes('instagram.com')) {
        if (url.includes("/p/") || url.includes("/reel/") || url.includes("/tv/")) {
          let rawJson = await scrapeInstagramPost(url);
          data = await extractIgPostData(rawJson);
          type = "post"
          console.log("this is a post url");
        } else {
          // type = "profile"
          // console.log("this is a profile url");
          // html = await scrapeInstagramProfileHTML(url);
          // data = await passMountDivContent(html);
          return res.status(400).json({
            status: false,
            message:"Instagram Profiles integrations are coming soon!"
          });
        }
      }
      else {
        return res.status(400).json({ error: "Invalid URL" });
      }

      if (userId) {
        let user = await User.findById(userId);
        
        if (user.credits > 0) {
            user.credits -= 1;
            await user.save();
        }
  
        if (user.credits <= 0) {
          user.subscription = "free";
          user.credits = 0;
          await user.save();
        }
      }
  
      return res.status(200).json({
        status: "success",
        platform: platform,
        data: data,
        type:type
      });
    } catch (err) {
      console.error("Error:", err);
      return res.status(500).json({
        status: "Something went wrong",
        error: err.message,
      });
    }
}

module.exports = {
    getDetails
}