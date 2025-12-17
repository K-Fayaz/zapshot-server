require('dotenv').config();
const cheerio = require('cheerio');
const axios = require("axios");
const snoowrap = require('snoowrap');

const getRedditClient = async () => {
    try {
        // Get access token using client credentials
        let ClientId = process.env.REDDIT_CLIENT_ID;
        let secret = process.env.REDDIT_CLIENT_SECRET;

        if (!ClientId || !secret) {
            throw new Error('Reddit Client ID or Secret not set in environment variables');
        }
        const auth = Buffer.from(`${ClientId}:${secret}`).toString('base64');
        
        const tokenResponse = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'ZapshotInApp/1.0 by /u/Enough_Machine_9164'
                }
            }
        );

        // Initialize snoowrap with access token
        const reddit = new snoowrap({
            userAgent: 'ZapshotInApp/1.0 by /u/Enough_Machine_9164',
            accessToken: tokenResponse.data.access_token
        });

        return reddit;
    } catch (error) {
        console.error('Error getting Reddit client:', error.response?.data || error.message);
        throw error;
    }
};

async function getRedditPostJSON(url) {
    try {
        // Extract post ID from URL
        const postId = url.match(/comments\/([a-z0-9]+)/)?.[1];
        if (!postId) {
            throw new Error('Invalid Reddit URL - cannot extract post ID');
        }

        console.log('Fetching Reddit post with OAuth, Post ID:', postId);

        let reddit = await getRedditClient();

        // Fetch the submission using snoowrap
        const submission = await reddit.getSubmission(postId);
        
        // Convert snoowrap object to JSON format that matches your existing structure
        const postData = await submission.fetch();
        
        // Structure the data to match Reddit's JSON API format
        const formattedData = [{
            data: {
                children: [{
                    data: {
                        title: postData?.title || '',
                        subreddit_name_prefixed: `r/${postData?.subreddit?.display_name}` || '',
                        ups: postData?.ups || 0,
                        author: postData?.author?.name || '',
                        num_comments: postData?.num_comments || 0,
                        selftext_html: postData?.selftext_html || '',
                        link_flair_background_color: postData?.link_flair_background_color || '',
                        author_flair_background_color: postData?.author_flair_background_color || '',
                        created_utc: postData?.created_utc || '',
                        link_flair_richtext: postData?.link_flair_richtext || [],
                        author_flair_richtext: postData.author_flair_richtext || [],
                        is_gallery: postData?.is_gallery || false,
                        is_video: postData?.is_video || false,
                        gallery_data: postData?.gallery_data,
                        media_metadata: postData?.media_metadata,
                        thumbnail: postData?.thumbnail,
                        url: postData?.url,
                        permalink: postData?.permalink,
                        score: postData?.score,
                        upvote_ratio: postData?.upvote_ratio,
                        url_overridden_by_dest: postData?.url_overridden_by_dest || '',
                        media: postData?.media || null,
                        preview: postData?.preview || {}
                    }
                }]
            }
        }];

        console.log('Successfully fetched Reddit post via OAuth:', postData?.title);
        return formattedData;

    } catch (error) {
        console.log('[getRedditPostJSON] OAuth method failed:', error.message);
        throw error;
    }
}

async function getRedditPostWithSubredditInfo(url) {
    try {
        const postId = url.match(/comments\/([a-z0-9]+)/)?.[1];
        if (!postId) {
            throw new Error('Invalid Reddit URL - cannot extract post ID');
        }

        // Fetch both submission and subreddit info using OAuth
        const reddit = await getRedditClient();
        const submission = await reddit.getSubmission(postId);
        const postData = await submission.fetch();
        const subredditData = await submission.subreddit.fetch();

        // Get subreddit icon directly from OAuth
        let subredditIcon = subredditData.community_icon || subredditData.icon_img || '';
        if (subredditIcon) {
            subredditIcon = subredditIcon.replace(/&amp;/g, "&");
        }

        return {
            postData,
            subredditIcon: subredditIcon || 'https://www.redditstatic.com/avatars/avatar_default_02_24A0ED.png'
        };

    } catch (error) {
        console.error('[getRedditPostWithSubredditInfo] Error:', error.message);
        throw error;
    }
}

const extractaDataFromJson = async (postJson,url) => {
    let postData = postJson[0].data.children[0].data;
    
    let title = postData?.title || '';
    let subreddit = postData?.subreddit_name_prefixed || '';
    let upvotes = postData?.ups || 0;
    let author = postData?.author || '';
    let comments = postData?.num_comments  || 0;
    let rawBody = postData?.selftext_html || '';
    let subredditIcon = '';
    let postFlairBackground = postData?.link_flair_background_color || '';
    let authorFlairBackground = postData?.author_flair_background_color || '';
    let authorFlairText;
    let authorFlairEmojees;
    let timeAgo = postData?.created_utc || 0;

    
    // Post Flair and Emoji
    let flairArray = postData?.link_flair_richtext || [];
    let emojiFlair = flairArray.find(flair => flair.e === 'emoji')?.u;
    let postFlair = flairArray.find(flair => flair.e === 'text')?.t;
    
    // Author Flair and Emojees
    authorFlairText = postData?.author_flair_richtext?.find(flair => flair.e === 'text')?.t?.trim() || '';
    authorFlairEmojees = postData?.author_flair_richtext?.map((item) => {
        if (item.e == "emoji") {
            return item.u;
        }
    });

    console.log("emojeesL :",authorFlairEmojees);

    body = rawBody;
    let images = [];

    if (subreddit) {
        let subredditData = await getRedditPostWithSubredditInfo(url);
        subredditIcon = subredditData?.subredditIcon || '';
    }

    let isGallery = postData?.is_gallery || false;
    let isVideo = postData?.is_video || false;

    if (isGallery) {
        let gallerItems = postData?.gallery_data?.items || [];
        images = gallerItems.map(item => {
            let mediaId = item?.media_id;
            let meta = postData?.media_metadata?.[mediaId];
            if (meta) {
                let ext = meta?.m?.split('/')?.[1] || 'jpg';
                return `https://i.redd.it/${mediaId}.${ext}`;
            }
            return null;
        }).filter(url => url !== null);
    } else if (!isVideo) {
        // regular express to validate thumbnail urls
        let urlPattern = /(https?:\/\/[^\s]+(\.jpg|\.jpeg|\.png|\.gif|\.bmp|\.webp))/i;

        if (postData?.preview?.images?.length > 0 ){
            console.log("postData?.preview?.images?.length > 0: ",postData?.preview.images[0].source.url)
            images = [postData?.preview.images[0].source.url]
        }

        if (images.length == 0 && postData?.url_overridden_by_dest && urlPattern.test(postData?.url_overridden_by_dest)) {  
            images = [postData?.url_overridden_by_dest];
        }

        if (images.length == 0 && postData?.thumbnail && urlPattern.test(postData?.thumbnail)) {  
            images = [postData?.thumbnail];
        }
    }

    if (isVideo) {
        // regular express to validate thumbnail urls
        let urlPattern = /(https?:\/\/[^\s]+(\.jpg|\.jpeg|\.png|\.gif|\.bmp|\.webp))/i;
        if (postData?.thumbnail && urlPattern.test(postData?.thumbnail)) {  
            images = [postData?.thumbnail.replace(/&amp;/g, "&")];
        }
    }

    return {
        title,
        subreddit,
        subredditIcon: subredditIcon || 'https://www.redditstatic.com/avatars/avatar_default_02_24A0ED.png',
        timeAgo,
        username: author,
        body, 
        postFlair,
        postFlairBackground,
        score: upvotes,
        commentCount: comments,
        images,
        emojiFlair,
        isVideoPresent: isVideo,
        authorFlairBackground,
        authorFlairEmojees,
        authorFlairText
    }

}

const getRedditVideoData = async (url) => {
    // Extract post ID from URL
    const postId = url.match(/comments\/([a-z0-9]+)/)?.[1];
    if (!postId) {
        throw new Error('Invalid Reddit URL - cannot extract post ID');
    }

    console.log('Fetching Reddit post with OAuth, Post ID:', postId);

    let reddit = await getRedditClient();

    // Fetch the submission using snoowrap
    const submission = await reddit.getSubmission(postId);
        
    // Convert snoowrap object to JSON format that matches your existing structure
    const postData = await submission.fetch();

    let videos = [];
    if (postData.is_video && postData.media?.reddit_video) {
        let videoInfo = postData?.media?.reddit_video;
        videos.push({
            quality: 'source',
            url: videoInfo?.fallback_url || '',
            width: videoInfo?.width || '',
            height: videoInfo?.height || '',
            is_gif: videoInfo?.is_gif || false,
            duration: videoInfo?.duration || 0
        });
    }
    return videos;
}

module.exports = {
    getRedditPostJSON,
    getRedditVideoData,
    extractaDataFromJson,
    getRedditPostWithSubredditInfo,
};