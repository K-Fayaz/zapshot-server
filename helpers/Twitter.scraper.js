const fs = require('fs');
const path = require('path');
const axios = require("axios");
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function scrapeTweet(url) {
    console.log('[scrapeTweet] Starting Puppeteer browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-web-security',
            '--no-first-run',
            '--no-zygote',
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
        console.log(`[scrapeTweet] Navigating to URL: ${url}`);
        // FIXME: Navigation timeout of 30000 ms exceeded - Fix this error
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        // Wait for the tweet article, but with a timeout
        await page.waitForSelector("article", { timeout: 15000 });

        // Optionally, try to close login modal if it appears
        try {
            await page.click('div[role="dialog"] div[aria-label="Close"]', { timeout: 3000 });
        } catch (e) {
            // Modal not present, ignore
        }

        const tweetHtml = await page.$eval("article", el => el.outerHTML);
        // fs.writeFileSync('./text3.html', tweetHtml);

        await browser.close();
        console.log('[scrapeTweet] Scraping completed successfully.');
        return tweetHtml;
    } catch (err) {
        await browser.close();
        console.log('[scrapeTweet] Error during scraping:', err);
        throw err;
    }
}

async function scrapeTweetProfile(url) {
    console.log('[scrapeTweet] Starting Puppeteer browser...');
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
          console.log(`[scrapeTweet] Navigating to URL: ${url}`);
          // FIXME: Navigation timeout of 30000 ms exceeded - Fix this error
          await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  
          const targetDiv = await page.$eval('#react-root', el => {
              // Navigate through the DOM structure:
              // react-root -> first child -> second child -> second child of second child
              const firstChild = el.children[0];
              if (!firstChild) return null;
              
              const secondLevelDiv = firstChild.children[0]; // second child of first child (2nd level)
              if (!secondLevelDiv) return null;
              
              const targetElement = secondLevelDiv.children[1]; // second child of second level div
              if (!targetElement) return null;
              
              return targetElement.outerHTML;
          });
  
          // console.log(targetDiv);
          return targetDiv;
      }
      catch(err) {
        console.log('[scrapeTweetProfile] Error during scraping:', err);
      }
}

async function scrapeTweetThreads(url) {
    console.log('[scrapeTweetThreads] Starting Puppeteer browser...');
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
        console.log(`[scrapeThread] Navigating to URL: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        
        // Wait for initial content
        await page.waitForSelector("article", { timeout: 15000 });
        
        // Close any modals
        try {
            await page.click('div[role="dialog"] div[aria-label="Close"]', { timeout: 3000 });
        } catch (e) {
            console.log('[scrapeThread] No modal to close');
        }
        
        // Wait for content to fully load
        console.log('[scrapeThread] Waiting for content to load...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Scroll to make sure everything loads
        console.log('[scrapeThread] Scrolling to load all content...');
        await page.evaluate(() => {
            window.scrollTo(0, 0); // Scroll to top first
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight); // Then scroll to bottom
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get the COMPLETE HTML of the entire page
        console.log('[scrapeThread] Extracting complete page HTML...');
        const fullPageHtml = await page.evaluate(() => {
            return document.documentElement.outerHTML;
        });
        
        console.log('[scrapeThread] =================================');
        console.log('[scrapeThread] COMPLETE PAGE HTML:');
        console.log('[scrapeThread] =================================');
        console.log(fullPageHtml);
        console.log('[scrapeThread] =================================');
        console.log('[scrapeThread] END OF HTML');
        console.log('[scrapeThread] =================================');
        
        console.log(`[scrapeThread] HTML length: ${fullPageHtml.length} characters`);

        // fs.writeFileSync('./text3.html', fullPageHtml);
        
        return fullPageHtml;
    } catch (err) {
        await browser.close();
        console.log('[scrapeTweetThreads] Error during scraping:', err);
        throw err;
    }
}

async function scrapeTweetHTML(url) {
    console.log('[scrapeTweetHTML] Starting Puppeteer browser...');
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
        console.log(`[scrapeTweetHTML] Navigating to URL: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        // Wait for the body element to be present
        await page.waitForSelector("body", { timeout: 15000 });

        // Optionally, try to close login modal if it appears
        try {
            await page.click('div[role="dialog"] div[aria-label="Close"]', { timeout: 3000 });
        } catch (e) {
            // Modal not present, ignore
        }

        const fullHtml = await page.content();

        await browser.close();
        console.log('[scrapeTweetHTML] Scraping completed successfully.');
        return fullHtml;
    } catch (err) {
        await browser.close();
        console.log('[scrapeTweetHTML] Error during scraping:', err);
        throw err;
    }
}

function extractTweetData(htmlString) {
    const $ = cheerio.load(htmlString);

    // Main tweet (first occurrence)
    let username = null;
    let userHandle = null;
    const usernameElem = $('[data-testid="User-Name"]').eq(0);
    if (usernameElem.length) {
      // Find all spans
      const spans = usernameElem.find('span');
      spans.each((i, el) => {
        const txt = $(el).text().trim();
        if (!username && !txt.startsWith('@') && !txt.includes('·')) {
          username = txt;
        }
        if (!userHandle && txt.startsWith('@')) {
          userHandle = txt;
        }
      });
    }
    // Main tweet time: look for the first <time> element
    let time = null;
    const timeElem = $('time').first();
    if (timeElem.length) {
      time = timeElem.text().trim();
    }

    // Profile Picture (main)
    const profileImgElem = $('[data-testid^="UserAvatar-Container-"] img').eq(0);
    const profileImg = profileImgElem.length ? profileImgElem.attr('src') : null;

    // Tweet Content (main)
    const tweetContentElem = $('[data-testid="tweetText"]').eq(0);
    const tweetContent = tweetContentElem.length ? tweetContentElem.html() : null;

    // Tweet Images (main) - collect all images into an array
    let tweetImages = [];
    let video = null;
    let isVideo = false;
    
    // First, check if main tweet has a video component
    const videoComponent = $('[data-testid="videoComponent"] video').eq(0);
    if (videoComponent.length) {
      const videoSrc = videoComponent.attr('src');
      const videoPoster = videoComponent.attr('poster');
      if (videoSrc || videoPoster) {
        video = {
          src: videoSrc || null,
          poster: videoPoster || null
        };
        isVideo = true;
      }
    }
    
    // If no video component found, check for video thumbnails in main tweet
    if (!video) {
      const videoThumbImg = $('[data-testid="card.layoutLarge.media"] img').eq(0);
      if (videoThumbImg.length) {
        const src = videoThumbImg.attr('src');
        if (src) {
          video = {
            src: null,
            poster: src
          };
          isVideo = true;
        }
      }
    }
    
    // Only collect images if there's no video in main tweet
    if (!video) {
      // Get all tweet photos (only from the main tweet, not quoted)
      const tweetPhotoImgs = $('[data-testid="tweetPhoto"] img');
      tweetPhotoImgs.each((i, el) => {
        const src = $(el).attr('src');
        if (src) {
          // Only add if this image belongs to the main tweet (not quoted)
          // Check if this image is NOT within the quoted tweet section (r-9aw3ui r-1s2bzr4)
          const isMainTweetImage = $(el).closest('.r-9aw3ui.r-1s2bzr4').length === 0;
          if (isMainTweetImage) {
            tweetImages.push(src);
          }
        }
      });
      
      // Fallback: check for any images with alt="Image" in main tweet
      if (tweetImages.length === 0) {
        const fallbackImgs = $('img[alt="Image"]').filter((i, el) => $(el).attr('src'));
        fallbackImgs.each((i, el) => {
          const src = $(el).attr('src');
          if (src) {
            // Only add if this image belongs to the main tweet
            const isMainTweetImage = $(el).closest('.r-9aw3ui.r-1s2bzr4').length === 0;
            if (isMainTweetImage) {
              tweetImages.push(src);
            }
          }
        });
      }
    }

    // --- Extract metrics: replies, retweets, likes, views ---
    let replies = null, retweets = null, likes = null, views = null;
    const metricsGroup = $('[role="group"]').first();
    if (metricsGroup.length) {
      // Replies
      const replyBtn = metricsGroup.find('button[data-testid="reply"]').first();
      if (replyBtn.length) {
        const replySpan = replyBtn.find('span').first();
        if (replySpan.length) replies = replySpan.text().trim();
      }
      // Retweets
      const retweetBtn = metricsGroup.find('button[data-testid="retweet"]').first();
      if (retweetBtn.length) {
        const retweetSpan = retweetBtn.find('span').first();
        if (retweetSpan.length) retweets = retweetSpan.text().trim();
      }
      // Likes
      const likeBtn = metricsGroup.find('button[data-testid="like"]').first();
      if (likeBtn.length) {
        const likeSpan = likeBtn.find('span').first();
        if (likeSpan.length) likes = likeSpan.text().trim();
      }
      // Views: look for the span with 'Views' nearby in metricsGroup
      let viewsCandidate = metricsGroup.find('span').filter((i, el) => $(el).text().trim().toLowerCase() === 'views').first();
      if (viewsCandidate.length) {
        const prev = viewsCandidate.prev();
        if (prev.length && prev.text()) {
          views = prev.text().trim();
        } else if (viewsCandidate.parent().length) {
          const numberSpan = viewsCandidate.parent().find('span').filter((i, el) => el !== viewsCandidate[0] && /[0-9]/.test($(el).text())).first();
          if (numberSpan.length) views = numberSpan.text().trim();
        }
      }
  
      // If not found in metricsGroup, try global search
      if (!views) {
        viewsCandidate = $('span').filter((i, el) => $(el).text().trim().toLowerCase() === 'views').first();
        if (viewsCandidate.length) {
          const prev = viewsCandidate.prev();
          if (prev.length && prev.text()) {
            views = prev.text().trim();
          } else if (viewsCandidate.parent().length) {
            const numberSpan = viewsCandidate.parent().find('span').filter((i, el) => el !== viewsCandidate[0] && /[0-9]/.test($(el).text())).first();
            if (numberSpan.length) views = numberSpan.text().trim();
          }
        }
      }
    }
  
    // --- Quoted Tweet Extraction (second occurrence) ---
    let isQuoted = false;
    let quoted = null;
    if ($('[data-testid="User-Name"]').length > 1 && $('[data-testid="tweetText"]').length > 1) {
      isQuoted = true;
      // Username (quoted)
      const qUsernameElem = $('[data-testid="User-Name"]').eq(1);
      // Username: first span inside User-Name that does NOT start with @ and does NOT contain '·'
      let qUsername = null;
      let qUserHandle = null;
      let qTime = null;
      if (qUsernameElem.length) {
        // Find all spans
        const spans = qUsernameElem.find('span');
        spans.each((i, el) => {
          const txt = $(el).text().trim();
          if (!qUsername && !txt.startsWith('@') && !txt.includes('·')) {
            qUsername = txt;
          }
          if (!qUserHandle && txt.startsWith('@')) {
            qUserHandle = txt;
          }
          if (!qTime && txt.includes('·')) {
            qTime = txt.replace('·', '').trim();
          }
        });
      }
      // Profile Picture (quoted)
      const qProfileImgElem = $('[data-testid^="UserAvatar-Container-"] img').eq(1);
      const qProfileImg = qProfileImgElem.length ? qProfileImgElem.attr('src') : null;
      // Tweet Content (quoted)
      const qTweetContentElem = $('[data-testid="tweetText"]').eq(1);
      const qTweetContent = qTweetContentElem.length ? qTweetContentElem.html() : null;
      // Tweet Images (quoted) - collect all images into an array
      let qTweetImages = [];
      let qVideo = null;
      let qIsVideo = false;
      
      // Check for video components in quoted tweet
      const qVideoComponent = $('[data-testid="videoComponent"] video').eq(1);
      if (qVideoComponent.length) {
        const qVideoSrc = qVideoComponent.attr('src');
        const qVideoPoster = qVideoComponent.attr('poster');
        if (qVideoSrc || qVideoPoster) {
          qVideo = {
            src: qVideoSrc || null,
            poster: qVideoPoster || null
          };
          qIsVideo = true;
        }
      }
      
      // If no video component found, check for video thumbnails in quoted tweet
      if (!qVideo) {
        const qVideoThumbImg = $('[data-testid="card.layoutLarge.media"] img').eq(1);
        if (qVideoThumbImg.length) {
          const src = qVideoThumbImg.attr('src');
          if (src) {
            qVideo = {
              src: null,
              poster: src
            };
            qIsVideo = true;
          }
        }
      }
      
      // Only collect images if there's no video in quoted tweet
      if (!qVideo) {
        // Get all tweet photos for quoted tweet (only from the quoted tweet section)
        const qTweetPhotoImgs = $('[data-testid="tweetPhoto"] img');
        qTweetPhotoImgs.each((i, el) => {
          const src = $(el).attr('src');
          if (src) {
            // Only add if this image belongs to the quoted tweet section (r-9aw3ui r-1s2bzr4)
            const isQuotedTweetImage = $(el).closest('.r-9aw3ui.r-1s2bzr4').length > 0;
            if (isQuotedTweetImage) {
              qTweetImages.push(src);
            }
          }
        });
        
        // Fallback: check for any images with alt="Image" in quoted tweet
        if (qTweetImages.length === 0) {
          const qFallbackImgs = $('img[alt="Image"]').filter((i, el) => $(el).attr('src'));
          qFallbackImgs.each((i, el) => {
            const src = $(el).attr('src');
            if (src) {
              // Only add if this image belongs to the quoted tweet
              const isQuotedTweetImage = $(el).closest('.r-9aw3ui.r-1s2bzr4').length > 0;
              if (isQuotedTweetImage) {
                qTweetImages.push(src);
              }
            }
          });
        }
      }
      quoted = {
        username: qUsername || qUserHandle,
        userHandle: qUserHandle,
        profileImg: qProfileImg,
        tweetContent: qTweetContent,
        tweetImages: qTweetImages,
        video: qVideo,
        isVideo: qIsVideo,
        time: qTime
      };
    }

    return { 
      username, 
      userHandle, 
      profileImg, 
      tweetContent, 
      tweetImages, 
      video, 
      replies, 
      retweets, 
      likes, 
      views, 
      isVideo, 
      isQuoted, 
      quoted, 
      time
    };
}

function extractTweetDataNew(htmlString) {
    const $ = cheerio.load(htmlString);

    // Find the main tweet article
    const tweetArticle = $('[data-testid="tweet"]');
    if (!tweetArticle.length) {
        throw new Error('Tweet article not found');
    }

    // Navigate to the div with 6 children as per user's detailed structure
    let targetDiv = tweetArticle;
    targetDiv = targetDiv.children().first(); // First div inside article
    if (!targetDiv.length) return null;
    
    targetDiv = targetDiv.children().first(); // Second div
    if (!targetDiv.length) return null;
    
    targetDiv = targetDiv.children().eq(2); // Third div (this should have 6 children)
    if (!targetDiv.length) return null;

    const children = targetDiv.children();
    if (children.length < 6) {
        console.warn(`Expected 6 children, found ${children.length}`);
    }

    // Extract main tweet content from the first child of targetDiv
    const mainTweetContentDiv = children.eq(0);
    const mainTweetText = mainTweetContentDiv.find('[data-testid="tweetText"]').first();
    // console.log(mainTweetContentDiv)
    const tweetContent = mainTweetText.length ? mainTweetText.html() : null;
    // console.log("tweetContent: ",tweetContent);

    // Extract main tweet media and quoted tweet from the second child of targetDiv
    const mediaAndQuotedDiv = children.eq(1);
    const mediaAndQuotedChildren = mediaAndQuotedDiv.children();
    
    // Main tweet media div has child divs:
    // Could be 0, 1, or 2 children:
    // - 0: No media, no quoted tweet
    // - 1: Either main tweet media OR quoted tweet (need to check which)
    // - 2: Main tweet media (first child) + quoted tweet (second child)
    const mainTweetMediaDiv = mediaAndQuotedChildren.eq(0);
    const mainTweetMediaChildren = mainTweetMediaDiv.children();
    
    let tweetImages = [];
    let video = null;
    let isVideo = false;
    let isQuoted = false;
    let quoted = null;
    
    if (mainTweetMediaChildren.length === 0) {
        // No media, no quoted tweet
        // Do nothing, all variables remain null/false
    } else if (mainTweetMediaChildren.length === 1) {
        // Only one child - need to determine if it's main tweet media or quoted tweet
        const singleChild = mainTweetMediaChildren.eq(0);

         // Check if this child is a quoted tweet by looking for profile details
         // If it has profile details (User-Name or UserAvatar), it's a quoted tweet
         // If it doesn't have profile details, it's main tweet media
         const hasProfileDetails = singleChild.find('[data-testid="User-Name"]').length > 0 || 
                                   singleChild.find('[data-testid^="UserAvatar-Container-"]').length > 0;
         
         if (!hasProfileDetails) {
            // This is main tweet media
            const mainTweetMediaContentDiv = singleChild;
            console.log("main tweet");
            
            // Check for video in main tweet media
            const mainTweetVideo = mainTweetMediaContentDiv.find('[data-testid="videoComponent"] video').first();
            if (mainTweetVideo.length) {
                const videoSrc = mainTweetVideo.attr('src');
                const videoPoster = mainTweetVideo.attr('poster');
                if (videoSrc || videoPoster) {
                    video = { src: videoSrc || null, poster: videoPoster || null };
                    isVideo = true;
                }
            }
            
            // Collect images from main tweet media
            const mainTweetPhotos = mainTweetMediaContentDiv.find('[data-testid="tweetPhoto"] img');
            mainTweetPhotos.each((i, el) => {
                const src = $(el).attr('src');
                if (src && !src.includes('amplify_video_thumb')) { 
                    tweetImages.push(src); 
                }
            });
          
          } else {
            // This is a quoted tweet (no main tweet media)
            const quotedTweetDiv = singleChild;
            const quotedTweetText = quotedTweetDiv.find('[data-testid="tweetText"]').first();
            if (quotedTweetText.length) {
                isQuoted = true;
                const qTweetContent = quotedTweetText.html();
                
                // Extract quoted tweet user info
                const qUsernameElem = quotedTweetDiv.find('[data-testid="User-Name"]').first();
                let qUsername = null, qUserHandle = null, qTime = null,qVerified = false;
                if (qUsernameElem.length) {
                    const spans = qUsernameElem.find('span');
                    spans.each((i, el) => {
                        const txt = $(el).text().trim();
                        if (!qUsername && !txt.startsWith('@') && !txt.includes('·')) {
                            qUsername = txt;
                        }
                        if (!qUserHandle && txt.startsWith('@')) {
                            qUserHandle = txt;
                        }
                        
                        // if (!qTime && txt.includes('·')) {
                        //     qTime = txt.replace('·', '').trim();
                        // }
                        const qTimeElem = quotedTweetDiv.find('a time').first();
                        if (qTimeElem.length) qTime = qTimeElem.text().trim();
                        console.log("qTime: ",qTime);
                    });
                }

                // Check if the user is verified
                const qVerifiedElem = quotedTweetDiv.find('[data-testid="User-Name"] svg[aria-label="Verified account"]');
                if (qVerifiedElem.length) {
                  qVerified = true;
                }
                // Extract quoted tweet profile image
                const qProfileImgElem = quotedTweetDiv.find('[data-testid^="UserAvatar-Container-"] img').first();
                const qProfileImg = qProfileImgElem.length ? qProfileImgElem.attr('src') : null;
                
                let qTweetImages = [];
                let qVideo = null;
                let qIsVideo = false;
                
                // Check for video in quoted tweet
                const qVideoComponent = quotedTweetDiv.find('[data-testid="videoComponent"] video').first();
                if (qVideoComponent.length) {
                    const qVideoSrc = qVideoComponent.attr('src');
                    const qVideoPoster = qVideoComponent.attr('poster');
                    if (qVideoSrc || qVideoPoster) {
                        qVideo = { src: qVideoSrc || null, poster: qVideoPoster || null };
                        qIsVideo = true;
                    }
                }
                
                // If no video, collect images from quoted tweet
                if (!qVideo) {
                    const qTweetPhotos = quotedTweetDiv.find('[data-testid="tweetPhoto"] img');
                    qTweetPhotos.each((i, el) => {
                        const src = $(el).attr('src');
                        if (src) { qTweetImages.push(src); }
                    });
                }
                
                quoted = { 
                    username: qUsername || qUserHandle, 
                    userHandle: qUserHandle, 
                    profileImg: qProfileImg, 
                    tweetContent: qTweetContent, 
                    tweetImages: qTweetImages, 
                    video: qVideo, 
                    isVideo: qIsVideo, 
                    time: qTime,
                    verified: qVerified
                };
            }
        }
    } else if (mainTweetMediaChildren.length >= 2) {
        // Two or more children: first is main tweet media, second is quoted tweet
        const mainTweetMediaContentDiv = mainTweetMediaChildren.eq(0);
        
        // Check for video in main tweet media
        const mainTweetVideo = mainTweetMediaContentDiv.find('[data-testid="videoComponent"] video').first();
        if (mainTweetVideo.length) {
            const videoSrc = mainTweetVideo.attr('src');
            const videoPoster = mainTweetVideo.attr('poster');
            if (videoSrc || videoPoster) {
                video = { src: videoSrc || null, poster: videoPoster || null };
                isVideo = true;
            }
        }

        // console.log("before : ",tweetImages)
        
        // Collect images from main tweet media
        const mainTweetPhotos = mainTweetMediaContentDiv.find('[data-testid="tweetPhoto"] img');
        mainTweetPhotos.each((i, el) => {
            const src = $(el).attr('src');
            if (src && !src.includes('amplify_video_thumb')) { 
                tweetImages.push(src); 
            }
        });
        // console.log("After : ",tweetImages)

        // Quoted tweet is in the second child
        const quotedTweetDiv = mainTweetMediaChildren.eq(1);
        const quotedTweetText = quotedTweetDiv.find('[data-testid="tweetText"]').first();
        if (quotedTweetText.length) {
            isQuoted = true;
            const qTweetContent = quotedTweetText.html();
            
            // Extract quoted tweet user info
            const qUsernameElem = quotedTweetDiv.find('[data-testid="User-Name"]').first();
            let qUsername = null, qUserHandle = null, qTime = null, qVerified = false;
            if (qUsernameElem.length) {
                const spans = qUsernameElem.find('span');
                spans.each((i, el) => {
                    const txt = $(el).text().trim();
                    if (!qUsername && !txt.startsWith('@') && !txt.includes('·')) {
                        qUsername = txt;
                    }
                    if (!qUserHandle && txt.startsWith('@')) {
                        qUserHandle = txt;
                    }
                    // if (!qTime && txt.includes('·')) {
                    //     qTime = txt.replace('·', '').trim();
                    // }
                    const qTimeElem = quotedTweetDiv.find('a time').first();
                    if (qTimeElem.length) qTime = qTimeElem.text().trim();
                    console.log("qTime: ",qTime); 
                });
            }

            // Check if the user is verified
            const qVerifiedElem = quotedTweetDiv.find('[data-testid="User-Name"] svg[aria-label="Verified account"]');
            if (qVerifiedElem.length) {
              qVerified = true;
            }
            
            // Extract quoted tweet profile image
            const qProfileImgElem = quotedTweetDiv.find('[data-testid^="UserAvatar-Container-"] img').first();
            const qProfileImg = qProfileImgElem.length ? qProfileImgElem.attr('src') : null;
            
            let qTweetImages = [];
            let qVideo = null;
            let qIsVideo = false;
            
            // Check for video in quoted tweet
            const qVideoComponent = quotedTweetDiv.find('[data-testid="videoComponent"] video').first();
            if (qVideoComponent.length) {
                const qVideoSrc = qVideoComponent.attr('src');
                const qVideoPoster = qVideoComponent.attr('poster');
                if (qVideoSrc || qVideoPoster) {
                    qVideo = { src: qVideoSrc || null, poster: qVideoPoster || null };
                    qIsVideo = true;
                }
            }
            
            // If no video, collect images from quoted tweet
            if (!qVideo) {
                const qTweetPhotos = quotedTweetDiv.find('[data-testid="tweetPhoto"] img');
                qTweetPhotos.each((i, el) => {
                    const src = $(el).attr('src');
                    if (src) { qTweetImages.push(src); }
                });
            }
            
            quoted = { 
                username: qUsername || qUserHandle, 
                userHandle: qUserHandle, 
                profileImg: qProfileImg, 
                tweetContent: qTweetContent, 
                tweetImages: qTweetImages, 
                video: qVideo, 
                isVideo: qIsVideo, 
                time: qTime,
                verified: qVerified
            };
        }
    }
    // console.log("quoted: ",quoted);
    // Extract main tweet metadata (username, handle, profile image, time) from the overall tweetArticle
    let username = null, userHandle = null, profileImg = null, time = null, verified = false, hasPoll = false,pollOptions = null,isLivePoll = false;
    const usernameElem = tweetArticle.find('[data-testid="User-Name"]').first();
    if (usernameElem.length) {
        const spans = usernameElem.find('span');
        spans.each((i, el) => {
            const txt = $(el).text().trim();
            if (!username && !txt.startsWith('@') && !txt.includes('·')) {
                username = txt;
            }
            if (!userHandle && txt.startsWith('@')) {
                userHandle = txt;
            }
        });
    }

    // Check for verified badge
    const mainTweetUser = tweetArticle.find('[data-testid="User-Name"]').first();
    const verifiedBadge = mainTweetUser.find('svg[aria-label="Verified account"]');
    if (verifiedBadge.length) { 
      verified = true;
    }
    
    const profileImgElem = tweetArticle.find('[data-testid^="UserAvatar-Container-"] img').first();
    profileImg = profileImgElem.length ? profileImgElem.attr('src') : null;

    const timeElems = tweetArticle.find("time");
    console.log("time elements found: ", timeElems.length);

    let mainTimeElem;
    if (timeElems.length > 1) {
      mainTimeElem = timeElems.eq(1);  // second time element
    } else {
      mainTimeElem = timeElems.first();  // only one time element
    }

    // Get ISO datetime attribute (reliable)
    time = mainTimeElem.text().trim();

    // Extract metrics (replies, retweets, likes, views) from the overall tweetArticle
    let replies = null, retweets = null, likes = null, views = null, bookmarks = null;
    const metricsGroup = tweetArticle.find('[role="group"]').first();
    if (metricsGroup.length) {
        // Replies
        const replyBtn = metricsGroup.find('button[data-testid="reply"]').first();
        if (replyBtn.length) {
            const replySpan = replyBtn.find('span').first();
            if (replySpan.length) replies = replySpan.text().trim();
        }
        // Retweets
        const retweetBtn = metricsGroup.find('button[data-testid="retweet"]').first();
        if (retweetBtn.length) {
            const retweetSpan = retweetBtn.find('span').first();
            if (retweetSpan.length) retweets = retweetSpan.text().trim();
        }
        // Likes
        const likeBtn = metricsGroup.find('button[data-testid="like"]').first();
        if (likeBtn.length) {
            const likeSpan = likeBtn.find('span').first();
            if (likeSpan.length) likes = likeSpan.text().trim();
        }

        const bookmarkButton = metricsGroup.find('button[data-testid="bookmark"]').first();
        if (bookmarkButton.length) {
            const bookmarkSpan = bookmarkButton.find('span').first();
            if (bookmarkSpan.length) bookmarks = bookmarkSpan.text().trim();
        }
        // Views
        let viewsCandidate = metricsGroup.find('span').filter((i, el) => $(el).text().trim().toLowerCase() === 'views').first();
        if (viewsCandidate.length) {
            const prev = viewsCandidate.prev();
            if (prev.length && prev.text()) {
                views = prev.text().trim();
            } else if (viewsCandidate.parent().length) {
                const numberSpan = viewsCandidate.parent().find('span').filter((i, el) => el !== viewsCandidate[0] && /[0-9]/.test($(el).text())).first();
                if (numberSpan.length) views = numberSpan.text().trim();
            }
        }
        
        // If not found in metricsGroup, try global search
        if (!views) {
            viewsCandidate = $('span').filter((i, el) => $(el).text().trim().toLowerCase() === 'views').first();
            if (viewsCandidate.length) {
                const prev = viewsCandidate.prev();
                if (prev.length && prev.text()) {
                    views = prev.text().trim();
                } else if (viewsCandidate.parent().length) {
                    const numberSpan = viewsCandidate.parent().find('span').filter((i, el) => el !== viewsCandidate[0] && /[0-9]/.test($(el).text())).first();
                    if (numberSpan.length) views = numberSpan.text().trim();
                }
            }
        }
    }

    let pollDiv = tweetArticle.find('[data-testid="cardPoll"]');
    if (pollDiv.length) {
      hasPoll = true;
      
      let options = [];
      
      // loop over each poll option
      pollDiv.find('li[role="listitem"]').each(function () {
        let optionText = $(this).find('div[dir="ltr"] span').first().text().trim();
        let votePercentText = $(this).find('div[dir="ltr"] span').last().text().trim();

        // some options may not have a percentage (if poll is ongoing), handle that
        let votePercent = votePercentText.includes('%')
          ? parseFloat(votePercentText.replace('%', ''))
          : null;

        options.push({
          option: optionText,
          votes: votePercent
        });
      });

      let totalVotesText = pollDiv.find('div:contains("votes")').first().text();

      if (options.length === 0) {
        isLivePoll = true;
        // fix typo: aria-label
        let votelessOptions = pollDiv.find('[aria-label="Poll options"]');

        votelessOptions.find('[role="radio"]').each(function () {
          let optionText = $(this).find('div[dir="ltr"] span').first().text().trim();
          options.push({
            option: optionText,
            votes: 0
          });
        });

        let statusText = pollDiv.find('div[dir="ltr"] span:contains("vote")').parent().first().text().trim();
        totalVotesText = statusText;
      }

      // total votes (bottom div)

      pollOptions = {
        options,
        totalVotes: totalVotesText
      };
    }

    return { 
        username: username || userHandle,
        userHandle, 
        verified,
        profileImg, 
        tweetContent, 
        tweetImages, 
        video, 
        replies, 
        retweets, 
        likes, 
        bookmarks,
        views, 
        isVideo, 
        isQuoted, 
        quoted, 
        time,
        isLivePoll,
        hasPoll,
        pollOptions
    };
}

function extractTwitterProfileData(htmlString) {
    const $ = cheerio.load(htmlString);
  
    // Extract profile name (display name) - looking for spans that don't start with @
    let profileName = null;
    $('[data-testid="UserName"] span').each((i, el) => {
      const text = $(el).text().trim();
      if (text && !text.startsWith('@') && !text.includes('·') && !profileName) {
        profileName = text;
      }
    });
  
    // Extract profile handle (@username) - looking for spans that start with @
    let profileHandle = null;
    $('[data-testid="UserName"] span').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.startsWith('@') && !profileHandle) {
        profileHandle = text;
      }
    });
  
    // Extract bio/description
    const bioHTML = $('[data-testid="UserDescription"]').html() || null;
  
    // Extract joined date
    const joinedDateText = $('[data-testid="UserJoinDate"] span').last().text().trim();
    const joinedDate = joinedDateText ? joinedDateText.replace('Joined ', '') : null;
  
    // Extract total posts count
    const postsText = $('h2[role="heading"] + div').text().trim();
    const totalPosts = postsText || null;
  
    // Extract followers count - get the raw text from the span
    const followersText = $('a[href*="/verified_followers"] span').first().text().trim();
    const followers = followersText || null;
  
    // Extract following count - get the raw text from the span
    const followingText = $('a[href*="/following"] span').first().text().trim();
    const following = followingText || null;
  
    // Extract profile picture URL
    const profilePicture = $('[data-testid*="UserAvatar"] img').attr('src') || null;
  
    // Extract banner image URL
    const bannerImage = $('a[href*="/header_photo"] img').attr('src') || null;
  
    // Extract verification status - look for SVG with aria-label="Verified account"
    const verified = $('svg[aria-label="Verified account"]').length > 0;
  
    // Extract user URL
    const userUrl = $('[data-testid="UserUrl"]').text().trim() || null;
  
    // Extract user location
    const userLocation = $('[data-testid="UserLocation"]').text().trim() || null;
  
    // Extract user professional category
    const userProfessionalCategory = $('[data-testid="UserProfessionalCategory"]').text().trim() || null;
  
    return {
      profileName,
      profileHandle,
      bioHTML,
      joinedDate,
      totalPosts,
      followers,
      following,
      profilePicture,
      bannerImage,
      verified,
      userUrl,
      userLocation,
      userProfessionalCategory
    };
}


async function downloadFile(url, dest) {
  const writer = fs.createWriteStream(dest);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}`);
  await new Promise((resolve, reject) => {
    res.body.pipe(writer);
    res.body.on('error', reject);
    writer.on('finish', resolve);
  });
}

async function combineAudioVideoFromUrls(urls) {
  const videoUrl = urls.find(url => /vid\/.*1280x720.*\.mp4/.test(url)) || urls.find(url => /vid\/.*\.mp4/.test(url));
  const audioUrl = urls.find(url => /aud\/.*128000.*\.mp4/.test(url)) || urls.find(url => /aud\/.*\.mp4/.test(url));

  if (!videoUrl || !audioUrl) throw new Error('Suitable video or audio stream not found');

  const tempDir = path.join(__dirname, '../tmp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const id = uuidv4();
  const videoPath = path.join(tempDir, `${id}_video.mp4`);
  const audioPath = path.join(tempDir, `${id}_audio.mp4`);
  const outputPath = path.join(tempDir, `${id}_merged.mp4`);

  // Download both streams
  await downloadFile(videoUrl, videoPath);
  await downloadFile(audioUrl, audioPath);

  // Merge via ffmpeg
  await new Promise((resolve, reject) => {
    exec(
      `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental "${outputPath}"`,
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });

  // Optional: delete temp files here if you don’t need them later
  fs.unlinkSync(videoPath);
  fs.unlinkSync(audioPath);

  return { outputPath };
}

/**
 * Scrape Twitter video URLs by intercepting network responses.
 * Returns an array of video URLs (mp4/m3u8) found during page load.
 */
async function scrapeTweetVideoUrls(url) {
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
      protocolTimeout: 180000,
      timeout: 120000
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
  await page.setRequestInterception(true);
  page.on('request', req => req.continue());
  const foundVideoUrls = new Set();
  page.on('response', async res => {
      try {
          const resUrl = res.url();
          if (
              resUrl.includes('video.twimg.com') &&
              (resUrl.endsWith('.mp4') || resUrl.includes('.m3u8'))
          ) {
              foundVideoUrls.add(resUrl);
          }
      } catch (e) {}
  });
  try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 10000));
  } finally {
      await browser.close();
  }
  return Array.from(foundVideoUrls);
}


module.exports = {
    scrapeTweet,
    scrapeTweetProfile,
    scrapeTweetThreads,
    extractTweetData,
    extractTweetDataNew,
    extractTwitterProfileData,
    scrapeTweetHTML,
    scrapeTweetVideoUrls, // <-- export the new function,
    combineAudioVideoFromUrls
}