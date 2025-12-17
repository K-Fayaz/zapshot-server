const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const axios = require("axios");

puppeteer.use(StealthPlugin());

  
async function scrapePeerlistPost(url) {
    console.log('[scrapePeerlistPost] Starting Puppeteer browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--ignore-certificate-errors'
        ],
        protocolTimeout: 180000, // 3 minutes
        timeout: 120000 // 2 minutes browser launch timeout
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Set a realistic user-agent and language
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'accept-language': 'en-US,en;q=0.9'
    });
  
    try {
        console.log(`[scrapePeerlistPost] Navigating to URL: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2" });
  
        // Fetch only the <body> HTML content of the page
        const bodyHtml = await page.$eval('body', el => el.outerHTML);
  
        await browser.close();
        console.log('[scrapePeerlistPost] Scraping completed successfully.');
        return bodyHtml;
    } catch (err) {
        await browser.close();
        console.log('[scrapePeerlistPost] Error during scraping:', err);
        throw err;
    }
}

function extractPeerlistPostData(htmlString) {
  const $ = cheerio.load(htmlString);

  // Try to get from JSON-LD if available
  const jsonLdScript = $('script#__NEXT_DATA__').html();
  // console.log(jsonLdScript);
  let profileImg = null, username = null, profileHandle = null, contextLabel = null, title = null, content = null, upvotes = 0, comments = 0, reposts = 0, time = null, media = [], isVideo = false, embed = null, projectEmbed = null, linkEmbed = null;
  let pollEmbed = null;
  let articleEmbed = null;
  let jobEmbed = null;
  let reshareEmbed = null;
  let profileEmbed = null;

  if (jsonLdScript) {
    try {
      const json = JSON.parse(jsonLdScript);
      const postData = json?.props?.pageProps?.postData;
      // Profile info
      profileImg = postData?.postedBy?.profilePicture || postData?.metaData?.createdBy?.profilePicture || null;
      username = postData?.postedBy?.displayName || postData?.metaData?.createdBy?.displayName || null;
      profileHandle = postData?.postedBy?.profileHandle || postData?.metaData?.createdBy?.profileHandle || null;
      // Context label
      contextLabel = postData?.contextLabel || postData?.context || null;
      // Title
      title = postData?.postTitle || null;
      // Content
      content = postData?.caption || postData?.postOG?.description || null;
      // Upvotes, comments, reposts
      upvotes = postData?.upvoteCount ?? postData?.metaData?.upvotesCount ?? 0;
      comments = postData?.commentCount ?? postData?.metaData?.commentCount ?? 0;
      reposts = postData?.resharedCount ?? 0;
      // Time
      time = postData?.createdAt || postData?.timestamp || null;
      // Media: always use postData.media if present
      if (postData?.media && Array.isArray(postData.media)) {
        media = postData.media;
      }
      // isVideo
      isVideo = (postData?.videos && Array.isArray(postData.videos) && postData.videos.length > 0);
      // If video, filter out fallback and use postOG.image as thumbnail if present
      if (isVideo) {
        const VIDEO_FALLBACK = "https://dqy38fnwh4fqs.cloudfront.net/mobile/video-mobile-fallback.png";
        media = media.filter(url => url && url !== VIDEO_FALLBACK);
        if (postData?.postOG?.image) {
          media = [postData.postOG.image];
        }
      }
      // Filter out Peerlist's default "Read this post" image
      const DEFAULT_PEERLIST_IMAGE = "https://dqy38fnwh4fqs.cloudfront.net/website/scroll-post-og.webp";
      media = media.filter(url => url && url !== DEFAULT_PEERLIST_IMAGE);
      // Poll detection
      const jsonLD = postData?.jsonLD;
      if (jsonLD?.additionalType === "Poll") {
        const metaData = postData?.metaData || {};
        const options = metaData.option || {};
        const labels = Object.values(options).map(opt => opt.label).filter(Boolean);
        
        // Extract votes for each option
        const votes = {};
        let hasVotes = false;
        
        Object.keys(options).forEach(optionKey => {
          const option = options[optionKey];
          votes[optionKey] = option.votes || 0;
          if (option.votes || option.votes === 0) {
            hasVotes = true;
          }
        });

        pollEmbed = {
          type: "poll",
          endsOn: metaData.endOn,
          totalVotes: metaData.totalVotes,
          labels,
          hasVotes,
          votes
        };
      }

      console.log(postData);
      // Project embed detection (not else-if, so can coexist)
      if (postData?.embed === 'PROJECT' && postData?.metaData) {
        const meta = postData.metaData;
        projectEmbed = {
          type: 'project',
          title: meta.title || null,
          tagline: meta.tagline || null,
          logo: meta.logo || null,
          upvotes: meta.upvotesCount ?? null,
          comments: meta.commentCount ?? null,
          bookmarks: meta.bookmarkCount ?? null,
          categories: Array.isArray(meta.categories) ? meta.categories.map(cat => cat.name) : []
        };
      }
      // Article embed detection
      if (postData?.embed === 'ARTICLE' && postData?.metaData) {
        const meta = postData.metaData;
        articleEmbed = {
          type: 'article',
          title: meta.title || null,
          subtitle: meta.subTitle || null,
          keywords: meta?.seo?.keywords || [],
          upvoteCount: meta.upvoteCount ?? null,
          bookmarkCount: meta.bookmarkCount ?? null,
          commentCount: meta.commentCount ?? null,
          featuredImage: meta.featuredImage || null,
          readTime: meta.readTime || null,
          creator: meta.creator ? {
            displayName: meta.creator.displayName || null,
            profilePicture: meta.creator.profilePicture || null
          } : null
        };
      }
      // Job embed detection
      if (postData?.embed === 'JOB' && postData?.metaData) {
        const meta = postData.metaData;
        jobEmbed = {
          type: 'job',
          companyLogo: meta.company?.logo || null,
          companyName: meta.companyName || meta.company?.name || null,
          jobTitle: meta.jobTitle || null,
          location: meta.location || null,
          jobType: meta.jobType || null,
          publishedAt: meta.publishedAt || null,
          experience: meta.experience || null,
          skills: Array.isArray(meta.skills) ? meta.skills : []
        };
      }
      // User Profile embed detection
      if (postData?.embed === 'USER_PROFILE' && postData?.metaData) {
        const meta = postData.metaData;
        profileEmbed = {
          type: 'profile',
          username: meta.displayName || null,
          bio: meta.headline || null,
          profilePicture: meta.profilePicture || null,
          skills: Array.isArray(meta.skills) ? meta.skills.slice(0, 4) : []
        };
      }

      // Link embed
      if (media.length === 0 && postData?.metaData?.link) {
        linkEmbed = {
          type: 'link',
          link: postData.metaData.link || null,
          image: postData.metaData.image || null,
          description: postData.metaData.description || null,
          title: postData.metaData.title || null,
          tldr: postData.metaData?.tldr || null
        };
      }

      // Reshare embed detection (highest priority)
      if (postData?.reshared && postData?.metaData) {
        const meta = postData.metaData;
        reshareEmbed = {
          type: 'reshare',
          resharedContext: meta.resharedContext || null,
          postTitle: meta.postTitle || null,
          content: meta.caption || null,
          createdAt: meta.createdAt || null,
          media: Array.isArray(meta.media) ? meta.media : [],
          videos: Array.isArray(meta.videos) ? meta.videos : [],
          username: meta.postedBy?.displayName || null,
          profilePicture: meta.postedBy?.profilePicture || null
        };
      }

      // Apply embed hierarchy: reshareEmbed > jobEmbed > articleEmbed > pollEmbed > projectEmbed > profileEmbed > linkEmbed
      // Only keep the highest priority embed, set others to null
      if (reshareEmbed) {
        // If reshareEmbed exists, clear all lower priority embeds
        jobEmbed = null;
        articleEmbed = null;
        pollEmbed = null;
        projectEmbed = null;
        profileEmbed = null;
        linkEmbed = null;
      } else if (jobEmbed) {
        // If jobEmbed exists, clear all lower priority embeds
        articleEmbed = null;
        pollEmbed = null;
        projectEmbed = null;
        profileEmbed = null;
        linkEmbed = null;
      } else if (articleEmbed) {
        // If articleEmbed exists (and no higher priority embeds), clear all lower priority embeds
        pollEmbed = null;
        projectEmbed = null;
        profileEmbed = null;
        linkEmbed = null;
      } else if (pollEmbed) {
        // If pollEmbed exists (and no higher priority embeds), clear lower priority embeds
        projectEmbed = null;
        profileEmbed = null;
        linkEmbed = null;
      } else if (projectEmbed) {
        // If projectEmbed exists (and no higher priority embeds), clear lower priority embeds
        profileEmbed = null;
        linkEmbed = null;
      } else if (profileEmbed) {
        // If profileEmbed exists (and no higher priority embeds), clear linkEmbed
        linkEmbed = null;
      }
      // If only linkEmbed exists, keep it as is
    } catch (e) {}
  }

  return {
    profileImg,
    contextLabel,
    profileHandle,
    username,
    content,
    title,
    upvotes,
    comments,
    reposts,
    time,
    media,
    isVideo,
    pollEmbed,
    projectEmbed,
    linkEmbed,
    articleEmbed,
    jobEmbed,
    reshareEmbed,
    profileEmbed
  };
}

function extractPeerlistProfileData(htmlString) {
  const $ = cheerio.load(htmlString);

  // Try to get from JSON-LD if available
  const jsonLdScript = $('script#__NEXT_DATA__').html();
  // console.log(jsonLdScript)
  
  let displayName = null;
  let profileHandle = null;
  let followers = null;
  let profilePicture = null;
  let headline = null;
  let verified = null;
  let website = null;
  let createdAt = null;
  let skills = [];
  let projects = [];

  if (jsonLdScript) {
    try {
      const json = JSON.parse(jsonLdScript);
      const userData = json?.props?.pageProps?.user;
      
      if (userData) {
        // Extract basic profile information
        displayName = userData.displayName || null;
        profileHandle = userData.profileHandle || null;
        profilePicture = userData.profilePicture || null;
        headline = userData.headline || null;
        verified = userData.verified || false;
        website = userData.website || null;
        createdAt = userData.createdAt || null;
        
        // Extract followers count
        if (userData.networkCount && userData.networkCount.followers) {
          followers = userData.networkCount.followers;
        }
        
        // Extract skills - only the name part
        if (userData.skills && Array.isArray(userData.skills)) {
          skills = userData.skills.map(skill => skill.name || skill.label || skill.id).filter(Boolean);
        }
        
        // Extract projects
        if (userData.projects && Array.isArray(userData.projects)) {
          projects = userData.projects.map(project => ({
            title: project.title || null,
            tagline: project.tagline || null,
            logo: project?.logo || (project?.images && project.images.length > 0 ? project.images[0] : null) || null,
            categories: Array.isArray(project.categories) 
              ? project.categories.map(cat => cat.name).filter(Boolean)
              : [],
            commentCount: project.commentCount || 0,
            upvotesCount: project.upvotesCount || 0,
            bookmarkCount: project.bookmarkCount || 0
          }));
        }
      }
    } catch (e) {
      console.error('Error parsing JSON-LD script:', e);
    }
  }

  return {
    displayName,
    profileHandle,
    followers,
    profilePicture,
    headline,
    verified,
    website,
    createdAt,
    skills,
    projects
  };
}

module.exports = {
    scrapePeerlistPost,
    extractPeerlistPostData,
    extractPeerlistProfileData,
}