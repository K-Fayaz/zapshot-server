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

async function scrapeCompleteTwitterThread(url, options = {}) {
    const {
        maxScrollAttempts = 10,
        scrollDelay = 3000,
        waitForReplies = 5000,
        outputFile = './complete_thread.html',
        headless = true,
        debug = true,
        includeReplies = true,
        expandThread = true
    } = options;

    const log = (message) => {
        if (debug) console.log(`[ThreadScraper] ${new Date().toISOString()} - ${message}`);
    };

    log('Starting enhanced thread scraper...');
    
    const browser = await puppeteer.launch({
        headless: headless ? "new" : false,
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
            '--disable-blink-features=AutomationControlled'
        ],
        protocolTimeout: 300000, // 5 minutes
        timeout: 120000
    });

    const page = await browser.newPage();
    
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
        delete navigator.__proto__.webdriver;
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
    })

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'accept-language': 'en-US,en;q=0.9',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none'
    });

    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(90000);
    page.setDefaultNavigationTimeout(90000);

    try {
        log(`Navigating to thread URL: ${url}`);
        
        // Navigate to the thread
        await page.goto(url, { 
            waitUntil: ["networkidle0", "domcontentloaded"], 
            timeout: 45000 
        });
        
        log('Waiting for initial content to load...');
        await page.waitForSelector('[data-testid="tweet"], article[role="article"]', { timeout: 20000 });
        
        // Close modals and popups
        await handleModals(page, log);
        
        // Wait a bit for content to settle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // First, try to expand "Show this thread" if present
        if (expandThread) {
            await expandThreadIfNeeded(page, log);
        }
        
        // Click "Show replies" or similar buttons to reveal conversation
        if (includeReplies) {
            await expandReplies(page, log);
        }
        
        // Aggressive scrolling to load all thread content
        log('Starting aggressive scroll to load complete thread...');
        await performCompleteScroll(page, log, maxScrollAttempts, scrollDelay);
        
        // Try to load more replies by clicking "Show more replies" buttons
        await loadMoreReplies(page, log);
        
        // Final scroll to ensure everything is loaded
        await performFinalScroll(page, log);
        
        // Extract the complete thread data
        log('Extracting complete thread data...');
        const threadData = await extractThreadData(page);
        
        // Get the complete HTML
        const fullPageHtml = await page.evaluate(() => {
            return document.documentElement.outerHTML;
        });
        
        
        log(`Thread scraping completed!`);
        log(`- Main tweets: ${threadData.mainThread.length}`);
        log(`- Reply tweets: ${threadData.replies.length}`);
        log(`- Total content: ${threadData.totalTweets} tweets`);
        log(`- HTML size: ${(fullPageHtml.length / 1024 / 1024).toFixed(2)} MB`);

        // fs.writeFileSync('./text3.html', fullPageHtml);
        
        return {
            html: fullPageHtml,
            data: threadData,
            stats: {
                mainThreadTweets: threadData.mainThread.length,
                replyTweets: threadData.replies.length,
                totalTweets: threadData.totalTweets,
                htmlSizeMB: (fullPageHtml.length / 1024 / 1024).toFixed(2)
            }
        };
        
    } catch (err) {
        log(`Error during thread scraping: ${err.message}`);
        throw err;
    } finally {
        await browser.close();
        log('Browser closed');
    }
}

// Helper function to handle modals
async function handleModals(page, log) {
    const modalSelectors = [
        '[data-testid="sheetDialog"] [data-testid="app-bar-close"]',
        '[data-testid="confirmationSheetDialog"] [data-testid="confirmationSheetCancel"]',
        'div[role="dialog"] div[aria-label="Close"]',
        '[aria-label="Close"]',
        '[data-testid="ocfEnterTextTextInput"]',
        'button[aria-label="Close"]'
    ];

    for (const selector of modalSelectors) {
        try {
            await page.waitForSelector(selector, { timeout: 2000 });
            await page.click(selector);
            log(`Closed modal: ${selector}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
        } catch (e) {
            // Continue if modal not found
        }
    }
}

// Helper function to expand thread
async function expandThreadIfNeeded(page, log) {
    const threadExpanders = [
        'span:contains("Show this thread")',
        'div[role="button"]:contains("Show this thread")',
        '[data-testid="tweet"] span:contains("Show this thread")',
        'div:contains("Show this thread")'
    ];
    
    for (const selector of threadExpanders) {
        try {
            // Use XPath for text-based selection
            const xpath = `//span[contains(text(), 'Show this thread')] | //div[contains(text(), 'Show this thread')]`;
            const elements = await page.$x(xpath);
            
            if (elements.length > 0) {
                log('Found "Show this thread" - clicking to expand...');
                await elements[0].click();
                await new Promise(resolve => setTimeout(resolve, 3000));
                break;
            }
        } catch (e) {
            // Continue
        }
    }
}

// Helper function to expand replies
async function expandReplies(page, log) {
    try {
        // Look for "Show replies" or similar buttons
        const replyButtons = await page.$x(`
            //span[contains(text(), 'Show replies')] |
            //span[contains(text(), 'Show more replies')] |
            //div[contains(text(), 'Show replies')] |
            //div[contains(text(), 'Show more replies')]
        `);
        
        for (let button of replyButtons) {
            try {
                log('Clicking "Show replies" button...');
                await button.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                log(`Could not click reply button: ${e.message}`);
            }
        }
    } catch (e) {
        log('No reply expansion buttons found');
    }
}

// Helper function for complete scrolling
async function performCompleteScroll(page, log, maxAttempts, delay) {
    let previousHeight = 0;
    let stagnantScrolls = 0;
    let attempt = 0;
    
    while (attempt < maxAttempts && stagnantScrolls < 3) {
        // Scroll down in chunks
        await page.evaluate(() => {
            const scrollHeight = document.body.scrollHeight;
            const currentScroll = window.pageYOffset;
            const viewportHeight = window.innerHeight;
            
            // Scroll by 80% of viewport height
            window.scrollBy(0, viewportHeight * 0.8);
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Check current height
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        
        if (currentHeight === previousHeight) {
            stagnantScrolls++;
            log(`No new content loaded (attempt ${stagnantScrolls}/3)`);
        } else {
            stagnantScrolls = 0;
            log(`Scroll ${attempt + 1}/${maxAttempts} - New content loaded, height: ${currentHeight}`);
        }
        
        previousHeight = currentHeight;
        attempt++;
        
        // Try to load more content by looking for load buttons
        try {
            const loadMoreButtons = await page.$x(`
                //span[contains(text(), 'Show more replies')] |
                //span[contains(text(), 'Load more')] |
                //div[contains(text(), 'Show more')]
            `);
            
            for (let button of loadMoreButtons.slice(0, 2)) { // Only click first 2
                try {
                    await button.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (e) {
                    // Continue
                }
            }
        } catch (e) {
            // Continue
        }
    }
}

// Helper function to load more replies
async function loadMoreReplies(page, log) {
    let moreRepliesLoaded = true;
    let attempts = 0;
    
    while (moreRepliesLoaded && attempts < 5) {
        moreRepliesLoaded = false;
        attempts++;
        
        try {
            // Look for various "load more" type buttons
            const loadButtons = await page.$x(`
                //span[contains(text(), 'Show more replies')] |
                //span[contains(text(), 'Show additional replies')] |
                //span[contains(text(), 'Load more')] |
                //div[text()='Show more replies'] |
                //div[contains(@class, 'show-more')]
            `);
            
            log(`Found ${loadButtons.length} potential load-more buttons`);
            
            for (let i = 0; i < Math.min(loadButtons.length, 3); i++) {
                try {
                    await loadButtons[i].click();
                    log(`Clicked load-more button ${i + 1}`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    moreRepliesLoaded = true;
                } catch (e) {
                    log(`Failed to click load-more button: ${e.message}`);
                }
            }
        } catch (e) {
            log('No more load-more buttons found');
        }
        
        if (moreRepliesLoaded) {
            // Scroll a bit after loading more
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// Helper function for final scroll
async function performFinalScroll(page, log) {
    log('Performing final complete scroll...');
    
    // Scroll to top first
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then scroll to bottom slowly
    await page.evaluate(() => {
        return new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 200;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
}

// Helper function to extract thread data
async function extractThreadData(page) {
    return await page.evaluate(() => {
        const tweets = [];
        const mainThread = [];
        const replies = [];
        
        // Get all tweet articles
        const tweetElements = document.querySelectorAll('[data-testid="tweet"], article[role="article"]');
        
        tweetElements.forEach((tweet, index) => {
            try {
                const textElement = tweet.querySelector('[data-testid="tweetText"], [lang]');
                const text = textElement ? textElement.innerText.trim() : '';
                
                // Skip if no text content
                if (!text) return;
                
                const timeElement = tweet.querySelector('time');
                const timestamp = timeElement ? timeElement.getAttribute('datetime') : '';
                
                const userNameElement = tweet.querySelector('[data-testid="User-Name"]');
                const userName = userNameElement ? userNameElement.innerText.split('\n')[0] : '';
                
                const userHandleElement = tweet.querySelector('[data-testid="User-Name"] a[href*="/"]');
                const userHandle = userHandleElement ? userHandleElement.href.split('/').pop() : '';
                
                // Try to get tweet URL
                const tweetLinkElement = tweet.querySelector('time').closest('a');
                const tweetUrl = tweetLinkElement ? tweetLinkElement.href : '';
                
                // Check if it's likely a reply (has "Replying to" or is indented)
                const isReply = tweet.querySelector('[data-testid="reply"]') || 
                              tweet.textContent.includes('Replying to') ||
                              tweet.querySelector('div[dir="ltr"] > span[dir="ltr"]'); // Reply indicator
                
                // Extract media
                const images = Array.from(tweet.querySelectorAll('[data-testid="tweetPhoto"] img, img[src*="media"]')).map(img => ({
                    src: img.src,
                    alt: img.alt
                }));
                
                const videos = Array.from(tweet.querySelectorAll('video')).map(vid => ({
                    src: vid.src,
                    poster: vid.poster
                }));
                
                // Get engagement metrics
                const retweets = tweet.querySelector('[data-testid="retweet"]')?.textContent || '0';
                const likes = tweet.querySelector('[data-testid="like"]')?.textContent || '0';
                const replies_count = tweet.querySelector('[data-testid="reply"]')?.textContent || '0';
                
                const tweetData = {
                    index,
                    text,
                    userName,
                    userHandle,
                    timestamp,
                    tweetUrl,
                    isReply,
                    media: { images, videos },
                    engagement: {
                        retweets,
                        likes,
                        replies: replies_count
                    }
                };
                
                tweets.push(tweetData);
                
                if (isReply) {
                    replies.push(tweetData);
                } else {
                    mainThread.push(tweetData);
                }
                
            } catch (e) {
                console.error(`Error extracting tweet ${index}:`, e);
            }
        });
        
        return {
            url: window.location.href,
            extractedAt: new Date().toISOString(),
            mainThread,
            replies,
            allTweets: tweets,
            totalTweets: tweets.length,
            threadStats: {
                mainTweets: mainThread.length,
                replyTweets: replies.length,
                totalEngagements: tweets.reduce((sum, t) => sum + parseInt(t.engagement.likes) || 0, 0)
            }
        };
    });
}

module.exports = {
    scrapeCompleteTwitterThread
}