const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const axios = require("axios");

puppeteer.use(StealthPlugin());

// Helper function to convert image URL to base64
async function imageToBase64(url) {
  if (!url || typeof url !== 'string') {
    console.error('Invalid URL provided to imageToBase64:', url);
    return null;
  }
  
  try {
    // console.log(`Converting image to base64: ${url}`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });
    
    const buffer = Buffer.from(response.data, 'binary');
    const base64 = buffer.toString('base64');
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    
    // console.log(`Successfully converted image to base64: ${url}`);
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error converting image to base64: ${url}`, error.message);
    return null;
  }
}

// Helper function to convert multiple images to base64
async function convertImagesToBase64(imageUrls) {
  if (!imageUrls || !Array.isArray(imageUrls)) return [];
  
  const base64Promises = imageUrls.map(async (imageUrl) => {
    if (typeof imageUrl === 'string') {
      return await imageToBase64(imageUrl);
    } else if (imageUrl && imageUrl.src) {
      const base64 = await imageToBase64(imageUrl.src);
      return {
        ...imageUrl,
        src: base64 || imageUrl.src
      };
    }
    return imageUrl;
  });
  
  return await Promise.all(base64Promises);
}

async function scrapeThreadsPosts(url) {
    console.log('[scrapeThreadsPosts] Starting Puppeteer browser...');
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
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--ignore-ssl-errors-spki-list',
            '--ignore-certificate-errors-spki-list',
            '--allow-running-insecure-content',
            '--disable-features=VizDisplayCompositor,VizHitTestSurfaceLayer'
        ],
        protocolTimeout: 180000,
        timeout: 120000
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
  
    // Handle certificate errors
    await page.setBypassCSP(true);
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'accept-language': 'en-US,en;q=0.9'
    });
    
    // Listen for certificate errors and continue
    page.on('error', err => {
        console.log('[scrapeThreadsPosts] Page error:', err.message);
    });
    
    page.on('pageerror', err => {
        console.log('[scrapeThreadsPosts] Page error:', err.message);
    });
  
    try {
        console.log(`[scrapeThreadsPosts] Navigating to URL: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        
        await page.waitForSelector("body", { timeout: 15000 });
        
        const mountDivHtml = await page.$eval('div[id^="mount_"]', el => el.outerHTML);
  
        // console.log(mountDivHtml);
        
        await browser.close();
        console.log('[scrapeThreadsPosts] Scraping completed successfully.');
        return mountDivHtml;
    } catch (err) {
        await browser.close();
        console.log('[scrapeThreadsPosts] Error during scraping:', err);
        throw err;
    }
}

async function extractThreadsPostsData(htmlString,url) {
    console.log('[extractThreadsPostsData] Starting data extraction...');
    
    const $ = cheerio.load(htmlString);
    
    // Extract all posts from the page
    const posts = [];
    
    // Find all post containers using the data-pressable-container attribute
    // But exclude quoted post containers to avoid treating them as separate posts
    $('[data-pressable-container="true"]').not('.x6bh95i.x1gzj6u4.x1hvtcl2.x1e1ff7m.xgrrwr1.x7o7tq0.x1rs6hn2.xvb4t3y').each((index, container) => {
      const $container = $(container);
      
      // Extract username from profile link
      const usernameElement = $container.find('a[href^="/@"]').first();
      const username = usernameElement.attr('href')?.replace('/@', '') || null;
      
      // Extract profile photo (using the x90nhty class pattern)
      const profilePhoto = $container.find('.x90nhty img, img[alt*="profile picture"]').first().attr('src') || null;
      
      // Extract timestamp
      const timestampElement = $container.find('time[datetime]').first();
      const timestamp = timestampElement.attr('datetime') || null;
      const timeDisplay = timestampElement.text().trim() || null;
      
             // Extract post text content - look for the main post text container
       let description = null;
       
       // Try to find the main post text container
       const postTextContainer = $container.find('[data-testid="post-text"], .x1a6qonq.x6ikm8r.x10wlt62.xj0a0fe.x126k92a.x6prxxf.x7r5mf7').first();
       
       if (postTextContainer.length) {
         // Get the entire HTML content of the post text container
         description = postTextContainer.html();
       } else {
         // Fallback: try a more specific selector
         const fallbackContainer = $container.find('.x1a6qonq').first();
         if (fallbackContainer.length) {
           description = fallbackContainer.html();
         }
       }
      
      // Extract videos first to identify video thumbnails
      const videos = [];
      const videoThumbnails = new Set(); // Track video thumbnail URLs
      
      $container.find('video').each((i, element) => {
        const src = $(element).attr('src');
        const poster = $(element).attr('poster');
        if (src) {
          videos.push({
            src,
            poster,
            duration: $(element).attr('duration')
          });
          // Add poster/thumbnail URL to set if it exists
          if (poster) {
            videoThumbnails.add(poster);
          }
        }
      });
      
      // Extract images (using the x1xmf6yo class pattern for media containers)
      const images = [];
      $container.find('.x1xmf6yo img, .x1f7gzso img').each((i, element) => {
        const src = $(element).attr('src');
        const alt = $(element).attr('alt') || '';
        if (src && !src.includes('profile') && !src.includes('avatar')) {
          // Check if this image is a video thumbnail
          const isVideoThumbnail = videoThumbnails.has(src);
          
          // Check if this image is NOT inside the quoted post container
          const $element = $(element);
          const isInQuotedContainer = $element.closest('.x6bh95i.x1gzj6u4.x1hvtcl2.x1e1ff7m.xgrrwr1.x7o7tq0.x1rs6hn2.xvb4t3y').length > 0;
          
          if (!isInQuotedContainer) {
            images.push({
              src,
              alt,
              width: $(element).attr('width'),
              height: $(element).attr('height'),
              isVideo: isVideoThumbnail
            });
          }
        }
      });
      
      // Extract engagement metrics using SVG aria-labels
      let likes = '0';
      $container.find('svg[aria-label="Like"]').each((i, element) => {
        const likeContainer = $(element).closest('div');
        const likeCountElement = likeContainer.find('span').last();
        const likeText = likeCountElement.text().trim();
        if (likeText && !isNaN(likeText)) {
          likes = likeText;
        }
      });
      
      let comments = '0';
      $container.find('svg[aria-label="Comment"]').each((i, element) => {
        const commentContainer = $(element).closest('div');
        const commentCountElement = commentContainer.find('span').last();
        const commentText = commentCountElement.text().trim();
        if (commentText && !isNaN(commentText)) {
          comments = commentText;
        }
      });
      
      let reposts = '0';
      $container.find('svg[aria-label="Repost"]').each((i, element) => {
        const repostContainer = $(element).closest('div');
        const repostCountElement = repostContainer.find('span').last();
        const repostText = repostCountElement.text().trim();
        if (repostText && !isNaN(repostText)) {
          reposts = repostText;
        }
      });
      
      let shares = '0';
      $container.find('svg[aria-label="Share"]').each((i, element) => {
        const shareContainer = $(element).closest('div');
        const shareCountElement = shareContainer.find('span').last();
        const shareText = shareCountElement.text().trim();
        if (shareText && !isNaN(shareText)) {
          shares = shareText;
        }
      });
      
      // Extract external links
      const externalLinks = [];
      $container.find('a[href*="l.threads.com"]').each((i, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        if (href && text) {
          externalLinks.push({ text, url: href });
        }
      });
      
      // Extract post URL and ID
      const postUrl = $container.find('a[href*="/post/"]').first().attr('href') || null;
      let postId = null;
      
      if (postUrl) {
        // Extract ID from URL like "/@unwind_ai/post/DM1ep93Iq3j"
        const urlParts = postUrl.split('/');
        postId = urlParts[urlParts.length - 1]; // Get the last part as ID
      }
      
      // NEW: Extract quoted post if it exists
      let quoted = null;
      const quotedContainer = $container.find('.x6bh95i.x1gzj6u4.x1hvtcl2.x1e1ff7m.xgrrwr1.x7o7tq0.x1rs6hn2.xvb4t3y').first();
      
      if (quotedContainer.length) {
        // Extract quoted post username
        const quotedUsernameElement = quotedContainer.find('a[href^="/@"]').first();
        const quotedUsername = quotedUsernameElement.attr('href')?.replace('/@', '') || null;
        
        // Extract quoted post profile photo
        const quotedProfilePhoto = quotedContainer.find('.x90nhty img, img[alt*="profile picture"]').first().attr('src') || null;
        
        // Extract quoted post timestamp
        const quotedTimestampElement = quotedContainer.find('time[datetime]').first();
        const quotedTimestamp = quotedTimestampElement.attr('datetime') || null;
        const quotedTimeDisplay = quotedTimestampElement.text().trim() || null;
        
        // Extract quoted post text content
        let quotedDescription = null;
        const quotedTextContainer = quotedContainer.find('.x1a6qonq.x6ikm8r.x10wlt62.xj0a0fe.x126k92a.x6prxxf.xt0psk2').first();
        if (quotedTextContainer.length) {
          quotedDescription = quotedTextContainer.html();
        }
        
        // Extract quoted post images
        const quotedImages = [];
        quotedContainer.find('.x1xmf6yo img, .x1f7gzso img').each((i, element) => {
          const src = $(element).attr('src');
          const alt = $(element).attr('alt') || '';
          if (src && !src.includes('profile') && !src.includes('avatar')) {
            quotedImages.push({
              src,
              alt,
              width: $(element).attr('width'),
              height: $(element).attr('height')
            });
          }
        });
        
        // Extract quoted post URL and ID
        const quotedPostUrl = quotedContainer.find('a[href*="/post/"]').first().attr('href') || null;
        let quotedPostId = null;
        
        if (quotedPostUrl) {
          const urlParts = quotedPostUrl.split('/');
          quotedPostId = urlParts[urlParts.length - 1];
        }
        
        quoted = {
          username: quotedUsername,
          profilePhoto: quotedProfilePhoto,
          timestamp: quotedTimestamp,
          timeDisplay: quotedTimeDisplay,
          description: quotedDescription,
          images: quotedImages,
          postUrl: quotedPostUrl,
          postId: quotedPostId
        };
      }
      
      // Create post object
      const post = {
        username,
        profilePhoto,
        timestamp,
        timeDisplay,
        description,
        images,
        videos,
        likes,
        comments,
        reposts,
        shares,
        externalLinks,
        postUrl,
        postId,
        quoted: quoted?.username && quoted?.profilePhoto ? quoted : null
      };
      
      posts.push(post);
    });
    
    // If no posts found with the new method, fall back to the old method
    if (posts.length === 0) {
      console.log('[extractThreadsPostsData] No posts found with new method, using fallback...');
      
      // Extract title/username (fallback)
      const title = $('span[dir="auto"]').first().text().trim() || null;
      
      // Extract description/text content (fallback)
      const description = $('div[dir="auto"]').text().trim() || null;
      
      // Extract videos first to identify video thumbnails (fallback)
      const videos = [];
      const videoThumbnails = new Set();
      
      $('video').each((index, element) => {
        const src = $(element).attr('src');
        const poster = $(element).attr('poster');
        if (src) {
          videos.push({ src, poster });
          if (poster) {
            videoThumbnails.add(poster);
          }
        }
      });
      
      // Extract images array (fallback)
      const images = [];
      $('img').each((index, element) => {
        const src = $(element).attr('src');
        if (src && !src.includes('avatar') && !src.includes('profile')) {
          const isVideoThumbnail = videoThumbnails.has(src);
          images.push({ 
            src,
            isVideo: isVideoThumbnail
          });
        }
      });
      
      // Extract engagement metrics (fallback)
      const likes = $('span').filter((index, element) => {
        return $(element).text().includes('like') || $(element).text().includes('Like');
      }).first().text().trim() || '0';
      
      const comments = $('span').filter((index, element) => {
        return $(element).text().includes('comment') || $(element).text().includes('Comment');
      }).first().text().trim() || '0';
      
      const reposts = $('span').filter((index, element) => {
        return $(element).text().includes('repost') || $(element).text().includes('Repost');
      }).first().text().trim() || '0';
      
      const shares = $('span').filter((index, element) => {
        return $(element).text().includes('share') || $(element).text().includes('Share');
      }).first().text().trim() || '0';
      
      // Extract profile photo (fallback)
      const profilePhoto = $('img').filter((index, element) => {
        const src = $(element).attr('src');
        return src && (src.includes('avatar') || src.includes('profile'));
      }).first().attr('src') || null;
      
      posts.push({
        title,
        description,
        images,
        videos,
        likes,
        comments,
        reposts,
        shares,
        profilePhoto
      });
    }

     const parts = url.split("/");
     let postId = parts[5];
    //  console.log("handle ",userhandle); 
     
     // Collect all posts until we find the first match with userHandle
     let testData = [];
     let extractedData = null;
     
     for (let i = 0; i < posts.length; i++) {
       const item = posts[i];
       
       // Add this post to testData array
       testData.push(item);
       
       // Check if this post matches the userHandle
       if (item.postId === postId) {
         extractedData = item;
         break; // Exit the loop once we find the first match
       }
     }

    //  console.log("testData ",testData);
     
     // If no match found, use the first post as fallback
     if (testData && testData.length > 0) {
       extractedData = testData;
     } else {
        extractedData = [posts[0]];
     }
    
    // console.log('[extractThreadsPostsData] Extracted data:', extractedData);
    
    // Convert images to base64 for all posts in the array
    // console.log('[extractThreadsPostsData] Converting images to base64...');
    
    try {
      // Iterate through each post in the array
      for (let i = 0; i < extractedData.length; i++) {
        const post = extractedData[i];
        
        // Convert profile photo to base64
        if (post.profilePhoto) {
          // console.log(`[extractThreadsPostsData] Converting profile photo for post ${i + 1}...`);
          post.profilePhoto = await imageToBase64(post.profilePhoto);
        }
        
        // Convert media images to base64
        if (post.images && post.images.length > 0) {
          // console.log(`[extractThreadsPostsData] Converting ${post.images.length} media images for post ${i + 1}...`);
          post.images = await convertImagesToBase64(post.images);
        }
        
        // NEW: Convert quoted post images and profile photo to base64
        if (post.quoted) {
          // Convert quoted post profile photo to base64
          if (post.quoted.profilePhoto) {
            // console.log(`[extractThreadsPostsData] Converting quoted post profile photo for post ${i + 1}...`);
            post.quoted.profilePhoto = await imageToBase64(post.quoted.profilePhoto);
          }
          
          // Convert quoted post media images to base64
          if (post.quoted.images && post.quoted.images.length > 0) {
            // console.log(`[extractThreadsPostsData] Converting ${post.quoted.images.length} quoted post media images for post ${i + 1}...`);
            post.quoted.images = await convertImagesToBase64(post.quoted.images);
          }
        }
      }
      
      // console.log('[extractThreadsPostsData] Base64 conversion completed successfully');
    } catch (error) {
      console.error('[extractThreadsPostsData] Error during base64 conversion:', error);
      // Continue with original URLs if base64 conversion fails
    }
    
    return extractedData;
}

async function scrapeThreadsProfile(url) {
    console.log('[scrapeThreadsProfile] Starting Puppeteer browser...');
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
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--ignore-ssl-errors-spki-list',
            '--ignore-certificate-errors-spki-list',
            '--allow-running-insecure-content',
            '--disable-features=VizDisplayCompositor,VizHitTestSurfaceLayer'
        ],
        protocolTimeout: 180000,
        timeout: 120000
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
  
    // Handle certificate errors
    await page.setBypassCSP(true);
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'accept-language': 'en-US,en;q=0.9'
    });
    
    // Listen for certificate errors and continue
    page.on('error', err => {
        console.log('[scrapeThreadsProfile] Page error:', err.message);
    });
    
    page.on('pageerror', err => {
        console.log('[scrapeThreadsProfile] Page error:', err.message);
    });
  
    try {
        console.log(`[scrapeThreadsProfile] Navigating to URL: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        
        await page.waitForSelector("body", { timeout: 15000 });
        
        // Get the entire body HTML
        const bodyHtml = await page.$eval('body', el => el.outerHTML);
        
        // Also get the mount div HTML for comparison
        const mountDivHtml = await page.$eval('div[id^="mount_"]', el => el.outerHTML);
        
        await browser.close();
        console.log('[scrapeThreadsProfile] Scraping completed successfully.');
        
        // console.log(bodyHtml)
        return mountDivHtml;
    } catch (err) {
        await browser.close();
        console.log('[scrapeThreadsProfile] Error during scraping:', err);
        throw err;
    }
}

async function extractThreadsProfileData(htmlString, url) {
    try {
        console.log('[extractThreadsProfileData] Starting profile data extraction...');
        
        // Use cheerio to parse the HTML
        const $ = cheerio.load(htmlString);
        
        // Initialize profile data object
        const profileData = {
            displayName: null,
            userHandle: null,
            userBio: null,
            followers: null,
            profilePicture: null,
            links: [],
            interests: []
        };
        
        // Extract Display Name
        // Look for h1 elements inside div with class "xcrlgei" that contain the display name
        const displayNameElement = $('.xcrlgei h1').first();
        if (displayNameElement.length > 0) {
            profileData.displayName = displayNameElement.text().trim();
        } else {
            // Fallback: look for h1 elements with specific classes
            const fallbackDisplayName = $('h1.x1plvlek.xryxfnj').first();
            if (fallbackDisplayName.length > 0) {
                profileData.displayName = fallbackDisplayName.text().trim();
            } else {
                // Alternative selector for display name - look for h1 elements that don't contain @
                const altDisplayName = $('h1').filter((i, el) => {
                    const text = $(el).text().trim();
                    return text && text.length > 0 && !text.includes('@') && text !== 'journaltotweet';
                }).first();
                if (altDisplayName.length > 0) {
                    profileData.displayName = altDisplayName.text().trim();
                }
            }
        }
        
        // Extract User Handle
        // Look for span elements with specific classes that contain the user handle
        const userHandleElement = $('span.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft').first();
        if (userHandleElement.length > 0) {
            profileData.userHandle = userHandleElement.text().trim();
        } else {
            // Alternative selector for user handle - look for span elements that contain @ or are lowercase handles
            const altUserHandle = $('span').filter((i, el) => {
                const text = $(el).text().trim();
                return text && text.length > 0 && (text.includes('@') || (text === text.toLowerCase() && text.length > 0 && !text.includes(' ')));
            }).first();
            if (altUserHandle.length > 0) {
                profileData.userHandle = altUserHandle.text().trim();
            }
        }
        
        // Extract User Bio
        // Look for span elements in the bio section (after the profile header)
        const bioElement = $('.xw7yly9 span.x1plvlek.xryxfnj').first();
        if (bioElement.length > 0) {
            profileData.userBio = bioElement.text().trim();
        } else {
            // Alternative selector for bio
            const altBioElement = $('span.x1plvlek.xryxfnj').filter((i, el) => {
                const text = $(el).text().trim();
                return text && text.length > 0 && !text.includes('@') && !text.includes('followers') && text.length > 10;
            }).first();
            if (altBioElement.length > 0) {
                profileData.userBio = altBioElement.text().trim();
            }
        }
        
        // Extract Followers Count
        // Look for span elements containing "followers" text
        const followersElement = $('span:contains("followers")').first();
        if (followersElement.length > 0) {
            profileData.followers = followersElement.text().trim();
        } else {
            // Alternative selector for followers
            const altFollowersElement = $('span').filter((i, el) => {
                const text = $(el).text().trim();
                return text && text.includes('followers');
            }).first();
            if (altFollowersElement.length > 0) {
                profileData.followers = altFollowersElement.text().trim();
            }
        }
        
        // Extract Profile Picture
        // Look for img elements with alt attribute containing "profile picture"
        const profileImgElement = $('img[alt*="profile picture"]').first();
        if (profileImgElement.length > 0) {
            profileData.profilePicture = profileImgElement.attr('src');
        }
        
        // Extract Links
        // Look for span elements with specific classes that might contain links
        const linkElements = $('span.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft');
        linkElements.each((index, element) => {
            const linkText = $(element).text().trim();
            // Check if it looks like a URL or domain
            if (linkText.includes('.') && !linkText.includes(' ')) {
                profileData.links.push(linkText);
            }
        });
        
        // Extract Interests (if any)
        // Look for interests section - this might not exist in all profiles
        const interestsElements = $('[data-testid*="interest"], .interests, .tags');
        interestsElements.each((index, element) => {
            const interestText = $(element).text().trim();
            if (interestText && !profileData.interests.includes(interestText)) {
                profileData.interests.push(interestText);
            }
        });
        
        // Fallback extraction methods if primary selectors don't work
        if (!profileData.userHandle) {
            // Try to extract from URL if not found in HTML
            const urlMatch = url.match(/@([^\/]+)/);
            if (urlMatch) {
                profileData.userHandle = urlMatch[1];
            }
        }
        
        if (!profileData.followers) {
            // Try alternative selectors for followers
            const altFollowers = $('span').filter((i, el) => {
                const text = $(el).text().trim();
                return text && text.includes('followers');
            }).first();
            if (altFollowers.length > 0) {
                profileData.followers = altFollowers.text().trim();
            }
        }

        if (profileData.profilePicture) {
          try {
              console.log('[extractThreadsProfileData] Converting profile picture to base64...');
              profileData.profilePicture = await imageToBase64(profileData.profilePicture);
              console.log('[extractThreadsProfileData] Profile picture converted to base64 successfully');
          } catch (error) {
              console.error('[extractThreadsProfileData] Error converting profile picture to base64:', error);
              // Keep original URL if conversion fails
          }
      }
        
        // Clean up the data
        profileData.links = [...new Set(profileData.links)]; // Remove duplicates
        profileData.interests = [...new Set(profileData.interests)]; // Remove duplicates
        
        console.log('[extractThreadsProfileData] Profile data extraction completed:', {
            displayName: profileData.displayName,
            userHandle: profileData.userHandle,
            followers: profileData.followers,
            linksCount: profileData.links.length,
            interestsCount: profileData.interests.length
        });
        
        return profileData;
        
    } catch (error) {
        console.error('[extractThreadsProfileData] Error extracting profile data:', error);
        throw error;
    }
}


async function getThreadsVideo(url) {
    try {
        // Scrape the HTML content of the Threads post
        const htmlString = await scrapeThreadsPosts(url);
        // Extract post data (including videos)
        const postDataArr = await extractThreadsPostsData(htmlString, url);
        console.log(postDataArr);
        // postDataArr can be an array or object, normalize to array
        const posts = Array.isArray(postDataArr) ? postDataArr : [postDataArr];
        // Find the first post with a video
        for (const post of posts) {
            if (post.videos && post.videos.length > 0) {
                // Return the first video src
                return post.videos[0].src;
            }
        }
        // No video found
        return null;
    } catch (error) {
        console.error('[getThreadsVideo] Error:', error);
        return null;
    }
}

module.exports = {
    scrapeThreadsPosts,
    extractThreadsPostsData,
    scrapeThreadsProfile,
    extractThreadsProfileData,
    getThreadsVideo
}
  