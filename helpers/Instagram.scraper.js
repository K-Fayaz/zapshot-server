


const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require("fs");

puppeteer.use(StealthPlugin());

async function scrapeInstagramPost(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
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
        page.setDefaultTimeout(80000);
        page.setDefaultNavigationTimeout(80000);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'accept-language': 'en-US,en;q=0.9'
        });
        await page.goto(url, { waitUntil: "networkidle2" });

        const rawJson = await page.evaluate(() => {
        const scriptTag = Array.from(document.querySelectorAll("script[type='application/json']"))
            .find(el => el.innerText.includes("xdt_api__v1__media__shortcode__web_info"));
            return scriptTag ? scriptTag.innerText : null;
        });

        await browser.close();
        // fs.writeFileSync("./text2.html", bodyHtml)
        return rawJson;
    } catch (err) {
        if (browser) await browser.close();
        console.log("something went wrong: ", err);
        throw err;
    }
}

function extractCleanIgPostData(rawJson) {
  try {
    const parsed = JSON.parse(rawJson);

    function findKey(obj, targetKey) {
      if (typeof obj !== "object" || obj === null) return null;

      if (Object.prototype.hasOwnProperty.call(obj, targetKey)) {
        return obj[targetKey];
      }

      for (const key in obj) {
        const result = findKey(obj[key], targetKey);
        if (result) return result;
      }

      return null;
    }

    const igData = findKey(parsed, "xdt_api__v1__media__shortcode__web_info");
    if (!igData) throw new Error("IG data not found");

    // fs.writeFileSync('./text.json', JSON.stringify(igData))
    return igData?.items;
  } catch (err) {
    console.error("Failed to parse IG JSON:", err);
    throw err;
  }
}

function formatTimeAgo(unixTimestamp) {
  const now = Date.now();
  const postTime = unixTimestamp * 1000; // convert seconds → ms
  const diffMs = now - postTime;

  const absDiff = Math.abs(diffMs);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let timeString;
  if (seconds < 60) timeString = `${seconds}s`;
  else if (minutes < 60) timeString = `${minutes}m`;
  else if (hours < 24) timeString = `${hours}h`;
  else if (days < 30) timeString = `${days}d`;
  else if (months < 12) timeString = `${months}mo`;
  else timeString = `${years}y`;

  return diffMs >= 0 ? `${timeString} ago` : `in ${timeString}`;
}

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch image");

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  // Guess mime type from URL (default to jpeg)
  const mime = url.includes(".png") ? "image/png" : "image/jpeg";

  return `data:${mime};base64,${base64}`;
}

async function extractIgPostData(rawJson) {
    let igData = extractCleanIgPostData(rawJson);
    let userDetails = {};
    
    let username = null, verified = false, profile = null, fullname;

    let isCarousel = false, carouselMedia = [], display_uri = null, likes = 0, comments = 0, caption = null, time = null;
    if(igData && igData?.length) {
        igData = igData[0];

        username = igData?.user?.username || "";
        fullname = igData?.user?.full_name || "";

        if (igData?.user?.hd_profile_pic_url_info?.url) {
            profile = await fetchImageAsBase64(igData?.user?.hd_profile_pic_url_info?.url);
        } else if (igData?.user?.profile_pic_url) {
            profile = await fetchImageAsBase64(igData?.user?.profile_pic_url)[0];
        } else {
            profile = '';
        }

        verified = igData?.user?.is_verified || "";
        time = formatTimeAgo(igData?.taken_at) || igData?.taken_at || "";

        userDetails = {
            username,
            fullname,
            profile,
            verified
        }

        caption = igData?.caption?.text || "";
        likes = igData?.like_count || 0;
        comments = igData?.comment_count || 0;
        display_uri = await fetchImageAsBase64(igData?.display_uri) || "";

        isCarousel = igData?.carousel_media?.length > 0 ? true : false;

        if (igData?.carousel_media?.length) {
            carouselMedia = await Promise.all(
                igData.carousel_media.map(async (item) => {
                    let display = await fetchImageAsBase64(item?.display_uri) || '';
                    return {
                        isVideo: (item?.video_dash_manifest || item?.video_versions) ? true : false,
                        display_uri: display
                    };
                })
            );
        }
    }


    return {
        user: userDetails,
        isCarousel,
        carouselMedia,
        display_uri,
        likes,
        comments,
        caption,
        time
    }
}

async function scrapeInstagramProfile(url) {
    let browser;
    console.log("this is scraping url for profile details...");
    try {
        browser = await puppeteer.launch({
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
            timeout: 150000
        });
        const page = await browser.newPage();
        page.setDefaultTimeout(100000);
        page.setDefaultNavigationTimeout(100000);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'accept-language': 'en-US,en;q=0.9'
        });
        await page.goto(url, { waitUntil: "networkidle2" });
        const bodyHtml = await page.$eval('body', el => el.outerHTML);

        await browser.close();
        fs.writeFileSync("./text2.html", bodyHtml);
        return bodyHtml;
    } catch (err) {
        if (browser) await browser.close();
        console.log("something went wrong: ", err);
        throw err;
    }
}

async function scrapeInstagramProfileHTML(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
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
        page.setDefaultTimeout(80000);
        page.setDefaultNavigationTimeout(80000);
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'accept-language': 'en-US,en;q=0.9'
        });
        
        await page.goto(url, { waitUntil: "networkidle2" });

        // Wait for profile-specific elements to load
        try {
            // Wait for common Instagram profile elements to appear
            await page.waitForSelector('article, main', { timeout: 30000 });
            // Additional wait for dynamic content
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Scroll to trigger lazy loading
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight / 2);
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (e) {
            console.log("Profile elements might not have loaded completely:", e.message);
        }

        // Scrape only the div with id starting with "mount_"
        const mountDivHTML = await page.evaluate(() => {
            const mountDiv = document.querySelector('div[id^="mount_"]');
            return mountDiv ? mountDiv.outerHTML : null;
        });

        await browser.close();
        fs.writeFileSync('./text2.html', mountDivHTML);
        return mountDivHTML;
        
    } catch (err) {
        if (browser) await browser.close();
        console.log("something went wrong: ", err);
        throw err;
    }
}

async function extractInstagramProfileDetails(page) {
  const profileData = await page.evaluate(() => {
    // Helper function to get text from a selector, or null if not found
    const getText = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.textContent.trim() : null;
    };

    // Helper function to get the title attribute for full follower count
    const getTitle = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.getAttribute('title') : null;
    };

    // Check for the verified badge SVG
    const isVerified = !!document.querySelector('svg[aria-label="Verified"]');

    // Scrape the main details
    const username = getText('h2.x1lliihq');
    const fullName = getText('section.x1qgnrqa span.x1lliihq');
    
    // Scrape counts from the list items
    const postsEl = document.querySelector('ul li:nth-child(1) span.x5n08af span');
    const followersEl = document.querySelector('ul li:nth-child(2) span.x5n08af');
    const followingEl = document.querySelector('ul li:nth-child(3) span.x5n08af span');
    
    // Scrape the bio
    const bioText = getText('div.xmaf8s6 span');
    const profession = getText('div._ap3a._aaco._aacu._aacy._aad6._aade');
    const bio = profession && bioText ? `${profession}: ${bioText}` : bioText;

    return {
      username: username || 'N/A',
      fullName: fullName || 'N/A',
      isVerified: isVerified,
      posts: postsEl ? postsEl.textContent.trim() : 'N/A',
      followers: followersEl ? followersEl.getAttribute('title') : 'N/A',
      following: followingEl ? followingEl.textContent.trim() : 'N/A',
      bio: bio || 'N/A'
    };
  });

  console.log(profileData);
  return profileData;
}

async function passMountDivContent(divContent) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(divContent);

    const profileDetails = await extractInstagramProfileDetails(page);
    await browser.close();

    return profileDetails;
}

module.exports = {
    scrapeInstagramPost,
    extractIgPostData,
    scrapeInstagramProfile,
    scrapeInstagramProfileHTML,
    passMountDivContent
}