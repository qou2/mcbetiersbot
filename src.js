const {
    Client,
    GatewayIntentBits: GIB,
    Events: E,
    ChannelType,
    EmbedBuilder: EB,
    PermissionFlagsBits,
    PermissionFlagsBits: PFB,
    REST,
    Routes,
    ApplicationCommandOptionType: ACOT,
    Collection,
    ActivityType: AT,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    ModalBuilder,      
    TextInputBuilder,    
    TextInputStyle       
} = require('discord.js');
require('dotenv').config();
const cheerio = require('cheerio');
const { Octokit } = require('@octokit/rest');
const { generateEloImage } = require('./utils/imageGenerator');
const fs = require('fs');
const path = require('path');
const os = require('os');
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});
const REPO_OWNER = '';
const REPO_NAME = '';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('--', '--');
const DB_FILE = path.join(__dirname, 'ticket_data.json');
function initDB() {
    console.log('Initializing database...');
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            queues: {
                '1362088376198627518': {
                    AS: [],
                    EU: [],
                    NA: []
                }
            },
            activeTickets: {},
            ticketCounter: 0,
            ticketConfigs: {}
        };

        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
        }
    } else {
        console.log('Database file already exists');
    }
}
function readDB() {
    try {
        console.log('Reading database from:', DB_FILE);
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!data.queues) data.queues = {};
        if (!data.activeTickets) data.activeTickets = {};
        if (!data.ticketConfigs) data.ticketConfigs = {};
        if (!data.ticketCounter) data.ticketCounter = 0;
        if (!data.queues['1362088376198627518']) {
            data.queues['1362088376198627518'] = {
                AS: [],
                EU: [],
                NA: []
            };
        }
        console.log('Database read successfully. Configs:', Object.keys(data.ticketConfigs));
        return data;
    } catch (error) {
        console.error('Error reading database:', error);
        console.log('Reinitializing database...');
        initDB();
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
}

function writeDB(data) {
    try {
        console.log('Writing database to:', DB_FILE);
        console.log('Data to write:', JSON.stringify(data, null, 2));
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        console.log('Database written successfully');
        const verification = fs.readFileSync(DB_FILE, 'utf8');
        console.log('Verification - file size:', verification.length, 'bytes');
    } catch (error) {
        console.error('Error writing database:', error);
        console.error('Error details:', error.message);
    }
}
const client=new Client({intents:[GIB.Guilds,GIB.GuildMessages,GIB.MessageContent,GIB.GuildMembers]});
const CFG = {
    TICKET_CATEGORY_ID: '1362088376198627518',
    SUPPORT_TEAM_ROLE_ID: '1362075114492920030',
    MODERATOR_ROLE_ID: '1362075029990412398',
    AMBASSADOR_ROLE_ID: '1376544602978254848',
    OWNER_ROLE_ID: '1362075171267023040',
    ENHANCED_ROLE_ID: '1379433661497086024',
    MSG_DELAY_MS: 3000,
    LOG_CHANNEL_ID: '1362109759133585590',
    DB_FILE_PATH: path.join(__dirname, 'moderation_logs.json'),
    COLORS: {
        PRIMARY: 0x1cd0b9,
        SUCCESS: 0x56eb55,
        WARNING: 0xffd700,
        DANGER: 0xff3d3d,
        INFO: 0x40a8ff
    },
    PROTECTED_USER_IDS: [
        '510847369454026753', //qou2
        '1196831517276635260', //future
        '1403336702247829594',  //morad
        '1366657007809073193', //darryn
        '1305576953876582491', //bahu
        '384018329230376970' //leafli
    ]
};
function saveGiveaways() {
    try {
        const data = {
            giveaways: Array.from(activeGiveaways.entries()).map(([messageId, giveaway]) => [
                messageId,
                {
                    ...giveaway,
                    entries: Array.from(giveaway.entries)
                }
            ])
        };
        fs.writeFileSync('./giveaways.json', JSON.stringify(data, null, 2));
        console.log('Giveaways saved successfully');
    } catch (error) {
        console.error('Error saving giveaways:', error);
    }
}
function loadGiveaways() {
    try {
        if (!fs.existsSync('./giveaways.json')) {
            console.log('No giveaways.json file found, starting fresh');
            return;
        }

        const data = JSON.parse(fs.readFileSync('./giveaways.json', 'utf8'));
        for (const [messageId, giveaway] of data.giveaways || []) {
            const restoredGiveaway = {
                ...giveaway,
                entries: new Set(giveaway.entries || [])
            };
            activeGiveaways.set(messageId, restoredGiveaway);
            if (!restoredGiveaway.ended) {
                const timeLeft = restoredGiveaway.endTime - Date.now();
                if (timeLeft > 0) {
                    setTimeout(() => {
                        endGiveaway(messageId);
                    }, timeLeft);
                    console.log(`Restored giveaway ${messageId}, ends in ${Math.round(timeLeft/1000)} seconds`);
                } else {
                    console.log(`Ending overdue giveaway ${messageId}`);
                    setImmediate(() => endGiveaway(messageId));
                }
            }
        }
        console.log(`Loaded ${activeGiveaways.size} giveaways from file`);
    } catch (error) {
        console.error('Error loading giveaways:', error);
    }
}
client.on('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    loadGiveaways();
});
setInterval(saveGiveaways, 3000000);
const activeGiveaways = new Map();
const { EmbedBuilder } = require('discord.js');
const LOG_CHANNEL_ID = '1377634007193358506';
async function getFileContent(filePath) {
    try {
        const response = await octokit.rest.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: filePath
        });

        return {
            content: Buffer.from(response.data.content, 'base64').toString('utf-8'),
            sha: response.data.sha
        };
    } catch (error) {
        throw new Error(`Failed to get file content: ${error.message}`);
    }
}
async function updateFileContent(filePath, content, sha, commitMessage) {
    try {
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content).toString('base64'),
            sha: sha
        });
    } catch (error) {
        throw new Error(`Failed to update file: ${error.message}`);
    }
}
function insertPlayerIntoHTML(htmlContent, userId, username, region, tier) {
    const $ = cheerio.load(htmlContent);
    const regionClassMap = {
        'eu': 'eu',
        'na': 'na',
        'as': 'as'
    };
    const regionClass = regionClassMap[region.toLowerCase()] || region.toLowerCase();
    const regionDisplay = region.toUpperCase();
    const newPlayerCard = `
          <a href="https://discord.com/users/${userId}" class="player-card ${regionClass}">
            <div class="player-name">${username}</div>
            <div class="region-badge ${regionClass}">${regionDisplay}</div>
          </a>`;
    let tierPlayersContainer = null;
    const tierLabelClass = tier.toLowerCase().replace('+', 'plus');
    const tierLabel = $(`.tier-label.${tierLabelClass}`);
    if (tierLabel.length > 0) {
        tierPlayersContainer = tierLabel.siblings('.tier-players');
    }
    if (!tierPlayersContainer || tierPlayersContainer.length === 0) {
        $('.tier-label').each(function() {
            if ($(this).text().trim() === tier.toUpperCase()) {
                tierPlayersContainer = $(this).siblings('.tier-players');
                return false;
            }
        });
    }
    if (!tierPlayersContainer || tierPlayersContainer.length === 0) {
        $('.tier-column').each(function() {
            const labelText = $(this).find('.tier-label').text().trim();
            if (labelText === tier.toUpperCase()) {
                tierPlayersContainer = $(this).find('.tier-players');
                return false;
            }
        });
    }
    if (!tierPlayersContainer || tierPlayersContainer.length === 0) {
        throw new Error(`Tier section "${tier.toUpperCase()}" not found in HTML. Please check the HTML structure.`);
    }
    tierPlayersContainer.find('.empty-tier-message').remove();
    tierPlayersContainer.append(newPlayerCard);
    return $.html();
}
function removePlayerFromHTML(htmlContent, userId) {
    const $ = cheerio.load(htmlContent);
    const playerCard = $(`a.player-card[href="https://discord.com/users/${userId}"]`);
    if (playerCard.length === 0) {
        throw new Error(`Player with Discord ID ${userId} not found in tier list.`);
    }
    const playerName = playerCard.find('.player-name').text().trim();
    const regionBadge = playerCard.find('.region-badge').text().trim();
    let tierName = '';
    const tierContainer = playerCard.closest('.tier-players');
    if (tierContainer.length > 0) {
        const tierLabel = tierContainer.siblings('.tier-label');
        if (tierLabel.length > 0) {
            tierName = tierLabel.text().trim();
        } else {
            const tierColumn = tierContainer.closest('.tier-column');
            if (tierColumn.length > 0) {
                const label = tierColumn.find('.tier-label');
                if (label.length > 0) {
                    tierName = label.text().trim();
                }
            }
        }
    }
    playerCard.remove();
    if (tierContainer.length > 0 && tierContainer.find('.player-card').length === 0) {
        tierContainer.append('<div class="empty-tier-message">No players in this tier yet.</div>');
    }
    return {
        html: $.html(),
        removedPlayer: {
            name: playerName,
            region: regionBadge,
            tier: tierName,
            userId: userId
        }
    };
}
async function addPlayerToTierList(userId, username, region, gamemode, tier) {
    try {
        let filePath;
        if (gamemode === 'index') {
            filePath = 'index.html';
        } else {
            filePath = `${gamemode}.html`;
        }
        const fileData = await getFileContent(filePath);
        const updatedHTML = insertPlayerIntoHTML(
            fileData.content,
            userId,
            username,
            region,
            tier
        );
        const commitMessage = `Add ${username} to ${tier.toUpperCase()} tier in ${gamemode === 'index' ? 'main tier list' : gamemode}`;
        await updateFileContent(filePath, updatedHTML, fileData.sha, commitMessage);
        return true;
    } catch (error) {
        console.error('Error adding player to tier list:', error);
        throw error;
    }
}
async function removePlayerFromTierList(userId, gamemode) {
    try {
        let filePath;
        if (gamemode === 'index') {
            filePath = 'index.html';
        } else {
            filePath = `${gamemode}.html`;
        }
        const fileData = await getFileContent(filePath);
        const result = removePlayerFromHTML(fileData.content, userId);
        const commitMessage = `Remove ${result.removedPlayer.name} from ${gamemode === 'index' ? 'main tier list' : gamemode} tier list`;
        await updateFileContent(filePath, result.html, fileData.sha, commitMessage);

        return result.removedPlayer;
    } catch (error) {
        console.error('Error removing player from tier list:', error);
        throw error;
    }
}
client.on('guildMemberAdd', async (member) => {
    try {
        const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) return;

        const joinEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('📥 Member Joined')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 128 }))
            .addFields(
                { name: '👤 Username', value: `${member.user.tag}`, inline: true },
                { name: '🆔 User ID', value: `${member.user.id}`, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: '👥 Member Count', value: `${member.guild.memberCount}`, inline: true }
            )
            .setFooter({ text: 'MCBETIERS System' })
            .setTimestamp();

        await logChannel.send({ embeds: [joinEmbed] });
    } catch (error) {
        console.error('Error in guildMemberAdd event:', error);
    }
});

client.on('guildMemberRemove', async (member) => {
    try {
        const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) return;
        const joinedAt = member.joinedAt;
        let timeInServer = 'Unknown';
        if (joinedAt) {
            const timeMs = Date.now() - joinedAt.getTime();
            const days = Math.floor(timeMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            timeInServer = `${days} days, ${hours} hours`;
        }
        const leaveEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('📤 Member Left')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 128 }))
            .addFields(
                { name: '👤 Username', value: `${member.user.tag}`, inline: true },
                { name: '🆔 User ID', value: `${member.user.id}`, inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: '⏱️ Time in Server', value: timeInServer, inline: true },
                { name: '👥 Member Count', value: `${member.guild.memberCount}`, inline: true }
            )
            .setFooter({ text: 'MCBETIERS System' })
            .setTimestamp();

        await logChannel.send({ embeds: [leaveEmbed] });
    } catch (error) {
        console.error('Error in guildMemberRemove event:', error);
    }
});
function isProtectedUser(targetUserId, issuer) {
    if (!PROTECTED_USER_IDS.includes(targetUserId)) {
        return false;
    }
    if (issuer.roles && issuer.roles.cache && issuer.roles.cache.has(OWNER_ROLE_ID)) {
        return false;
    }
    return true;
}
const BOT_START_TIME=Date.now();
let modLogs=new Collection();
const deletedMessages = new Collection();
const h={
    updateActivity:async()=>{try{const targetGuildId='1362072291340718151';const targetGuild=client.guilds.cache.get(targetGuildId);let m=targetGuild?targetGuild.memberCount||0:0;if(targetGuild&&!m)m=(await targetGuild.members.fetch()).size;client.user.setActivity(`${m} members`,{type:AT.Watching});}catch(e){console.error('Activity error:',e);}} ,

    loadLogs:()=>{try{if(fs.existsSync(CFG.DB_FILE_PATH)){const d=JSON.parse(fs.readFileSync(CFG.DB_FILE_PATH,'utf8'));modLogs=new Collection(Object.entries(d));}else{modLogs=new Collection();h.saveLogs();}}catch(e){console.error('Error loading logs:',e);modLogs=new Collection();}},

    saveLogs:()=>{try{const d=Object.fromEntries(modLogs);fs.writeFileSync(CFG.DB_FILE_PATH,JSON.stringify(d,null,2),'utf8');}catch(e){console.error('Error saving logs:',e);}},

    isProtectedUser: (userId) => {
        return CFG.PROTECTED_USER_IDS.includes(userId);
    },
    formatUptime:(u)=>{const t=Math.floor(u/1000),d=Math.floor(t/86400),h=Math.floor((t%86400)/3600),m=Math.floor((t%3600)/60),s=t%60,p=[];if(d>0)p.push(`${d} day${d!==1?'s':''}`);if(h>0)p.push(`${h} hour${h!==1?'s':''}`);if(m>0)p.push(`${m} minute${m!==1?'s':''}`);if(s>0||p.length===0)p.push(`${s} second${s!==1?'s':''}`);return p.join(', ');},

    parseTime:(t)=>{const m=t.match(/^(\d+)([dhms])$/i);if(!m)return null;const a=parseInt(m[1]),u=m[2].toLowerCase(),mult={d:86400000,h:3600000,m:60000,s:1000};return mult[u]?a*mult[u]:null;},

    formatTime:(d)=>{if(d>=86400000)return`${Math.floor(d/86400000)} day(s)`;if(d>=3600000)return`${Math.floor(d/3600000)} hour(s)`;if(d>=60000)return`${Math.floor(d/60000)} minute(s)`;return`${Math.floor(d/1000)} second(s)`;},

    hasPermission: (m, c) =>
        m.roles.cache.has(CFG.ENHANCED_ROLE_ID) ||
        ['ping', 'uptime', 'membercount', 'snipe', 'elo', 'eloleaderboard', 'tournament'].includes(c) ||
        m.roles.cache.has(CFG.MODERATOR_ROLE_ID) ||
        (m.roles.cache.has(CFG.SUPPORT_TEAM_ROLE_ID) &&
            ['warn', 'modlogs', 'unrank', 'rank', 'status', 'cheater-add', 'elo-add', 'elo-remove', 'enroll', 'un-enroll', 'add', 'remove'].includes(c)),

    logAction:async(g,t,mod,tgt,r,d=null)=>{try{const cid=`${Date.now()}-${Math.floor(Math.random()*1000)}`;const e=new EB().setColor(h.getActionColor(t)).setTitle(`⚔️ Bedrock Moderation - Case #${cid}`).addFields({name:'🛡️ Action',value:t,inline:true},{name:'👤 User',value:`${tgt.user?.tag || tgt.tag} (${tgt.id})`,inline:true},{name:'🔨 Moderator',value:`${mod.tag} (${mod.id})`,inline:true},{name:'📝 Reason',value:r||'No reason provided'}).setTimestamp();if(d)e.addFields({name:'⏱️ Duration',value:h.formatTime(d),inline:true});const lc=await g.channels.fetch(CFG.LOG_CHANNEL_ID).catch(()=>null);if(lc)await lc.send({embeds:[e]});if(!modLogs.has(tgt.id))modLogs.set(tgt.id,[]);modLogs.get(tgt.id).push({caseId:cid,type:t,moderatorId:mod.id,moderatorTag:mod.tag,timestamp:Date.now(),reason:r||'No reason provided',duration:d?h.formatTime(d):null});h.saveLogs();return cid;}catch(e){console.error('Error logging action:',e);return null;}},

    getActionColor:(t)=>({ban:CFG.COLORS.DANGER,kick:CFG.COLORS.WARNING,mute:CFG.COLORS.INFO,warn:CFG.COLORS.PRIMARY}[t.toLowerCase()]||0x2F3136),
    getSystemInfo:async()=>{
        const cpu=process.cpuUsage(),
            tot=cpu.user+cpu.system,
            cpuP=((tot/1000000)/os.cpus().length).toFixed(2),
            mT=(os.totalmem()/(1024*1024*1024)).toFixed(2),
            mF=(os.freemem()/(1024*1024*1024)).toFixed(2),
            mU=(mT-mF).toFixed(2),
            mP=((mU/mT)*100).toFixed(2);

        const memUsage = process.memoryUsage();
        const processMemory = {
            rss: (memUsage.rss / (1024 * 1024)).toFixed(2),
            heapTotal: (memUsage.heapTotal / (1024 * 1024)).toFixed(2),
            heapUsed: (memUsage.heapUsed / (1024 * 1024)).toFixed(2),
            external: (memUsage.external / (1024 * 1024)).toFixed(2)
        };

        const loadAvg = os.loadavg();
        const netInterfaces = os.networkInterfaces();
        let netInfo = 'Not available';
        try {
            const interfaces = Object.keys(netInterfaces)
                .filter(iface => !iface.includes('lo') && netInterfaces[iface].some(addr => !addr.internal))
                .map(iface => `${iface}`);
            netInfo = interfaces.length ? interfaces.join(', ') : 'No external interfaces';
        } catch(e) {
            console.error('Error getting network info:', e);
        }

        let diskInfo = 'Not available';
        try {
            const disk = require('diskusage');
            const path = os.platform() === 'win32' ? 'c:' : '/';
            const info = disk.checkSync(path);
            diskInfo = {
                total: (info.total / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                free: (info.free / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                used: ((info.total - info.free) / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                percent: (((info.total - info.free) / info.total) * 100).toFixed(2) + '%'
            };
        } catch(e) {
            diskInfo = 'Add diskusage package for disk info';
            console.error('Error getting disk info:', e);
        }

        let tG=client.guilds.cache.size,tC=0,tM=0,tR=0;
        client.guilds.cache.forEach(g=>{
            tC+=g.channels.cache.size;
            tM+=g.memberCount;
            tR+=g.roles.cache.size;
        });
        const tTc = client.channels.cache.filter(c => c.type === ChannelType.GuildText && c.parentId === CFG.TICKET_CATEGORY_ID).size;

        return{
            os:{
                platform:os.platform(),
                release:os.release(),
                arch:os.arch(),
                cpus:os.cpus().length,
                cpuModel:os.cpus()[0].model,
                cpuUsage:`${cpuP}%`,
                cpuLoadAvg: {
                    '1min': loadAvg[0].toFixed(2),
                    '5min': loadAvg[1].toFixed(2),
                    '15min': loadAvg[2].toFixed(2)
                },
                memTotal:`${mT} GB`,
                memUsed:`${mU} GB (${mP}%)`,
                memFree:`${mF} GB`,
                uptime:h.formatUptime(process.uptime()*1000),
                hostname: os.hostname(),
                networkInterfaces: netInfo,
                disk: diskInfo
            },
            process:{
                pid: process.pid,
                ppid: process.ppid,
                title: process.title,
                memory: processMemory,
                uptime: h.formatUptime(process.uptime()*1000)
            },
            app:{
                node:process.version,
                discordjs:require('discord.js').version,
                botUptime:h.formatUptime(Date.now()-BOT_START_TIME)
            },
            stats:{
                guilds:tG,
                channels:tC,
                members:tM,
                roles:tR,
                ticketChannels:tTc,
                modLogCount:modLogs.size,
                commands: cmds.length
            }
        };
    }
};

h.updateActivity();
setInterval(h.updateActivity, 180000);

const cmds = [
{name:'mute',description:'Timeout a user for a specified duration',options:[{name:'user',description:'The user to timeout',type:ACOT.User,required:true},{name:'duration',description:'Duration of timeout (e.g., 1d, 2h, 30m, 45s)',type:ACOT.String,required:true},{name:'reason',description:'Reason for the timeout (optional)',type:ACOT.String,required:false}]},
{name:'purge',description:'Delete multiple messages from a channel',options:[{name:'amount',description:'Number of messages to delete (1-100)',type:ACOT.Integer,required:true},{name:'user',description:'Only delete messages from this user (optional)',type:ACOT.User,required:false},{name:'reason',description:'Reason for purging messages (optional)',type:ACOT.String,required:false}]},
{name:'kick',description:'Kick a user from the server',options:[{name:'user',description:'The user to kick',type:ACOT.User,required:true},{name:'reason',description:'Reason for the kick (optional)',type:ACOT.String,required:false}]},
{name:'ban',description:'Ban a user from the server',options:[{name:'user',description:'The user to ban',type:ACOT.User,required:true},{name:'delete_messages',description:'Delete messages from this user (in days, 0-7)',type:ACOT.Integer,required:false,choices:[{name:'Don\'t delete any',value:0},{name:'24 hours',value:1},{name:'3 days',value:3},{name:'7 days',value:7}]},{name:'reason',description:'Reason for the ban (optional)',type:ACOT.String,required:false}]},
{name:'warn',description:'Warn a user for rule violations',options:[{name:'user',description:'The user to warn',type:ACOT.User,required:true},{name:'reason',description:'Reason for the warning',type:ACOT.String,required:true}]},
{name:'modlogs',description:'View moderation history for a user',options:[{name:'user',description:'The user to check',type:ACOT.User,required:true}]},
{name:'status',description:'Show detailed information about the bot and server status'},
{name:'queue-status',description:'Check current queue status',options:[{name:'region',description:'Region to check (AS, EU, NA)',type:3,required:false,choices:[{name:'AS',value:'AS'},{name:'EU',value:'EU'},{name:'NA',value:'NA'}]}]},
{name:'ping',description:'Check the bot\'s response time and status'},
{name:'ticketembed',description:'Create a ticket embed with queue system',options:[{name:'category',description:'Category ID where tickets will be created',type:3,required:true},{name:'name',description:'Name of the ticket system',type:3,required:true},{name:'description',description:'Description for the ticket embed',type:3,required:true},{name:'button_name',description:'Text for the ticket button',type:3,required:true},{name:'prompts',description:'Prompts for ticket (format: 1st query=Name 2nd=Region //optional)',type:3,required:false}]},
{name:'stafflogs',description:'View moderation actions performed by a staff member',options:[{name:'staff',description:'The staff member to check logs for',type:ACOT.User,required:true},{name:'type',description:'Filter by action type (optional)',type:ACOT.String,required:false,choices:[{name:'All',value:'all'},{name:'Bans',value:'ban'},{name:'Mutes',value:'Mute'},{name:'Warns',value:'Warn'}]}]},
{name:'eval',description:'Execute JavaScript code (Admin only)',options:[{name:'code',description:'The JavaScript code to execute',type:ACOT.String,required:true}]},
{name:'uptime',description:'See how long the bot has been running'},
{name:'elo',description:'View a user\'s ELO and tier rankings',options:[{name:'user',description:'The user to check ELO for (defaults to yourself)',type:ACOT.User,required:false}]},
{name:'enroll',description:'Enroll a team in the tournament',options:[{name:'name',description:'The name of the team to enroll',type:ACOT.String,required:true}]},
{name:'unenroll',description:'Remove a team from the tournament',options:[{name:'name',description:'The name of the team to unenroll',type:ACOT.String,required:true}]},
{name:'tournament',description:'View all teams enrolled in the tournament'},
{name:'eloleaderboard',description:'View the top 10 players with highest ELO rankings'},
{name:'elo-add',description:'Add ELO to a user',options:[{name:'user',description:'The user to add ELO to',type:ACOT.User,required:true},{name:'elo-amount',description:'Amount of ELO to add',type:ACOT.Integer,required:true}]},
{name:'elo-remove',description:'Remove ELO from a user',options:[{name:'user',description:'The user to remove ELO from',type:ACOT.User,required:true},{name:'elo-amount',description:'Amount of ELO to remove',type:ACOT.Integer,required:true}]},
{name:'role-remove',description:'Remove a role from a user',options:[{name:'user',description:'The user to remove the role from',type:ACOT.User,required:true},{name:'role',description:'The role to remove',type:ACOT.Role,required:true}]},
{name:'role-add',description:'Add a role to a user',options:[{name:'user',description:'The user to add the role to',type:ACOT.User,required:true},{name:'role',description:'The role to add',type:ACOT.Role,required:true}]},
{name:'unmute',description:'Remove a timeout from a user',options:[{name:'user',description:'The user to remove timeout from',type:ACOT.User,required:true},{name:'reason',description:'Reason for removing the timeout (optional)',type:ACOT.String,required:false}]},
{name:'rolecolor',description:'Change the color of a role',options:[{name:'role',description:'The role to change the color of',type:ACOT.Role,required:true},{name:'color',description:'Hex color code (e.g. #FF0000 for red)',type:ACOT.String,required:true}]},
{name:'membercount',description:'Shows the current member count of the server'},
{name:'cheater-add',description:'Add a cheater to the database',options:[{name:'ign',description:'In-game name of the cheater',type:3,required:true},{name:'discord',description:'Discord username of the cheater',type:3,required:true},{name:'user_id',description:'User ID of the cheater',type:3,required:true},{name:'cheats_used',description:'Description of cheats used',type:3,required:true},{name:'date',description:'Date when cheating occurred (DD/MM/YYYY)',type:3,required:true},{name:'caught_by',description:'Staff member who caught the cheater',type:3,required:true},{name:'positive',description:'Positive evidence percentage',type:3,required:true},{name:'comment',description:'Additional comment about the cheater',type:3,required:true},{name:'report_number',description:'Report number',type:4,required:true},{name:'evidence',description:'Upload image/video evidence of cheating',type:11,required:false}]},
{name:'info',description:'Display detailed information about a server member',options:[{name:'user',description:'The user to get information about',type:ACOT.User,required:true}]},
{name:'reboot',description:'Restarts the bot (Admin only)',options:[{name:'reason',description:'Reason for restarting the bot',type:ACOT.String,required:false}]},
{name:'snipe',description:'View the most recently deleted message in the channel',options:[{name:'channel',description:'Channel to check for deleted messages (defaults to current channel)',type:ACOT.Channel,required:false}]},
{name:'giveaway',description:'Start a giveaway',options:[{name:'prize',description:'What is being given away',type:ACOT.String,required:true},{name:'duration',description:'How long the giveaway runs (e.g., 1h, 30m, 2d)',type:ACOT.String,required:true},{name:'winners',description:'Number of winners (default: 1)',type:ACOT.Integer,required:false},{name:'description',description:'Additional details about the giveaway',type:ACOT.String,required:false}]},
{name:'reroll',description:'Reroll a giveaway',options:[{name:'message_id',description:'Message ID of the giveaway to reroll',type:ACOT.String,required:true}]},
{name:'end',description:'End a giveaway early',options:[{name:'message_id',description:'Message ID of the giveaway to end',type:ACOT.String,required:true}]}
];

function checkForDuplicateCommands(commands) {
    const commandNames = new Map();
    const duplicates = [];

    commands.forEach((command, index) => {
        const name = command.name;
        if (commandNames.has(name)) {
            duplicates.push({
                name: name,
                firstIndex: commandNames.get(name),
                duplicateIndex: index
            });
        } else {
            commandNames.set(name, index);
        }
    });
    if (duplicates.length > 0) {
        console.log('DUPLICATE COMMANDS FOUND:');
        duplicates.forEach(dup => {
            console.log(`- Command "${dup.name}" appears at indices ${dup.firstIndex} and ${dup.duplicateIndex}`);
        });
        return false;
    }

    console.log('No duplicate commands found');
    return true;
}
function removeDuplicateCommands(commands) {
    const seen = new Set();
    const uniqueCommands = [];

    commands.forEach(command => {
        if (!seen.has(command.name)) {
            seen.add(command.name);
            uniqueCommands.push(command);
        } else {
            console.log(`Removed duplicate command: ${command.name}`);
        }
    });

    return uniqueCommands;
}
client.once(E.ClientReady, async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    h.loadLogs();
    await h.updateActivity();
    try {
        if (!process.env.DISCORD_TOKEN) {
            console.error('DISCORD_TOKEN not set!');
            return;
        }
        const rest = new REST({version: '10'}).setToken(process.env.DISCORD_TOKEN);
        console.log(`Original command count: ${cmds.length}`);
        if (!checkForDuplicateCommands(cmds)) {
            console.log('Removing duplicates...');
            cmds = removeDuplicateCommands(cmds);
        }
        console.log(`Final command count: ${cmds.length}`);
        for (const [gId, g] of client.guilds.cache) {
            try {
                console.log(`Registering ${cmds.length} commands for guild: ${g.name}`);
                await rest.put(Routes.applicationGuildCommands(client.user.id, gId), {body: cmds});
                console.log(`Successfully registered commands for guild ${g.name}`);
            } catch (e) {
                console.error(`Failed to register commands for guild ${g.name}:`, e.message);
                if (e.code === 50035) {
                    console.log(`Attempting to clear and re-register commands for ${g.name}...`);
                    try {
                        await rest.put(Routes.applicationGuildCommands(client.user.id, gId), {body: []});
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await rest.put(Routes.applicationGuildCommands(client.user.id, gId), {body: cmds});
                        console.log(`Successfully cleared and re-registered commands for ${g.name}`);
                    } catch (retryError) {
                        console.error(`Retry failed for guild ${g.name}:`, retryError.message);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error registering slash commands:', e);
    }
});
client.on(E.MessageDelete, async (message) => {
    if (!message.content || message.author.bot) return;
    deletedMessages.set(message.channel.id, {
        content: message.content,
        author: message.author,
        authorTag: message.author.tag,
        authorId: message.author.id,
        channelId: message.channel.id,
        createdAt: message.createdTimestamp,
        attachments: [...message.attachments.values()],
        deletedAt: Date.now()
    });
    setTimeout(() => {
        if (deletedMessages.has(message.channel.id)) {
            const stored = deletedMessages.get(message.channel.id);
            if (stored.deletedAt === Date.now()) {
                deletedMessages.delete(message.channel.id);
            }
        }
    }, 60 * 60 * 1000);
});
client.on(E.ChannelCreate,async(c)=>{
    try{
        if(c.type===CT.GuildText&&c.parentId===CFG.TICKET_CATEGORY_ID){
            const w=new EB().setColor(CFG.COLORS.PRIMARY).setTitle('🏆 MCBETIERS Testing Ticket')
                .setDescription('Thank you for opening a tier test ticket. Our team will assist you shortly.')
                .addFields({name:'📋 Required Information',value:'Please provide the following:\n• Minecraft Username\n• Platform (Xbox/PlayStation/PC/Mobile/Switch)\n• Region\n• Preferred Testing Gamemode'},
                    {name:'⏰ Response Time',value:'Due to a high volume of tickets, our response time may be delayed. Thank you for your patience!'},
                    {name:'📌 Next Steps',value:'A tester will review your application and contact you soon. Please be ready for further instructions.'})
                .setTimestamp().setFooter({text:'🎮 MCBETIERS System'});
            setTimeout(async()=>{try{await c.send({content:`<@${c.client.users.cache.get(c.topic)?.id}> <@&${CFG.SUPPORT_TEAM_ROLE_ID}>`,embeds:[w]});}catch(e){console.error('Error sending welcome message:',e);}},CFG.MSG_DELAY_MS);
        }
    }catch(e){console.error('Error handling new ticket:',e);}
});
client.on('messageCreate', async (message) => {
    if (message.author.bot && message.author.id !== client.user.id) return;
    const prefix = '.';
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    if (command === 'ban') {
        try {
            const hasPermission = message.author.id === client.user.id ||
                (message.member && message.member.permissions.has(PFB.BanMembers));

            if (!hasPermission) {
                return message.reply('🚫 You do not have permission to ban members.');
            }
            if (message.reference) {
                const mentionPattern = /<@!?(\d+)>/g;
                const mentionsInContent = [...message.content.matchAll(mentionPattern)].map(match => match[1]);
                if (mentionsInContent.length === 0) {
                    return message.reply('⚠️ To ban a user, you must directly mention them with @username. Replying with the ban command is not supported.');
                }
            }
            const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (!targetUser) {
                return message.reply('⚠️  Specify a valid user to ban. Usage: `.ban @user [days to delete messages] [reason]`');
            }
            const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
            let deleteDays = 0;
            let reason = `No reason provided by ${message.author.tag}`;
            if (message.author.id === client.user.id) {
                reason = `No reason provided via livebot`;
            }
            if (args.length > 1) {
                const dayArg = parseInt(args[1]);
                if (!isNaN(dayArg) && dayArg >= 0 && dayArg <= 7) {
                    deleteDays = dayArg;
                    if (args.length > 2) {
                        reason = args.slice(2).join(' ');
                        if (message.author.id === client.user.id) {
                            reason += ' (via livebot)';
                        }
                    }
                } else {
                    reason = args.slice(1).join(' ');
                    if (message.author.id === client.user.id) {
                        reason += ' (via livebot)';
                    }
                }
            }
            if (h.isProtectedUser(targetUser.id)) {
                message.reply('This user is protected and cannot be banned.');

                const logChannel = await message.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const attemptEmbed = new EB()
                        .setColor(CFG.COLORS.WARNING)
                        .setTitle('⚠️ Protected User Ban Attempt')
                        .setDescription(`An attempt was made to ban a protected user`)
                        .addFields(
                            {name: '👤 Protected User', value: `${targetUser.tag} (${targetUser.id})`, inline: true},
                            {name: '🔨 Attempted By', value: `${message.author.tag} (${message.author.id})${message.author.id === client.user.id ? ' via livebot' : ''}`, inline: true},
                            {name: '📝 Reason Provided', value: reason}
                        )
                        .setTimestamp()
                        .setFooter({text: '🎮 MCBETIERS Moderation'});
                    await logChannel.send({embeds: [attemptEmbed]});
                }
                return;
            }
            if (targetMember) {
                if (message.author.id !== client.user.id) {
                    if (targetMember.roles.highest.position >= message.member.roles.highest.position && message.member.id !== message.guild.ownerId) {
                        return message.reply('⚠️ You cannot ban a member with a higher or equal role.');
                    }
                }
                if (!targetMember.bannable) {
                    return message.reply('❌ I do not have permission to ban this user. They may have a higher role than me.');
                }
            }
            const banEmbed = new EB()
                .setColor(CFG.COLORS.DANGER)
                .setTitle('🔨 User Banned')
                .setDescription(`${targetUser.tag} has been banned from the server.`)
                .addFields(
                    {name: '👤 User', value: `${targetUser.tag} (${targetUser.id})`, inline: true},
                    {name: '🔨 Moderator', value: `${message.author.tag} (${message.author.id})${message.author.id === client.user.id ? ' via livebot' : ''}`, inline: true},
                    {name: '📝 Reason', value: reason},
                    {name: '🗑️ Message Deletion', value: `${deleteDays} day(s)`, inline: true}
                )
                .setTimestamp()
                .setFooter({text: '🎮 MCBETIERS Moderation'});
            try {
                const dmEmbed = new EB()
                    .setColor(CFG.COLORS.DANGER)
                    .setTitle(`🔨 You Have Been Banned`)
                    .setDescription(`You have been banned from ${message.guild.name}`)
                    .addFields(
                        {name: '📝 Reason', value: reason},
                        {name: '🔨 Banned By', value: `${message.author.tag}${message.author.id === client.user.id ? ' (via livebot)' : ''}`}
                    )
                    .setTimestamp()
                    .setFooter({text: '🎮 MCBETIERS System'});

                if (targetMember) {
                    await targetMember.send({embeds: [dmEmbed]}).catch(() => {
                    });
                }
            } catch (e) {
                console.log(`Could not send DM to ${targetUser.tag}: ${e.message}`);
            }
            const caseId = await h.logAction(message.guild, 'ban', message.author, targetUser, reason);
            await message.guild.members.ban(targetUser, {
                deleteMessageSeconds: deleteDays * 24 * 60 * 60,
                reason: `${reason} (Case #${caseId})`
            });
            await message.reply({
                content: `✅ Successfully banned ${targetUser.tag}`,
                embeds: [banEmbed]
            });
            const logChannel = await message.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({embeds: [banEmbed]});
            }
        } catch (e) {
            console.error('Error in .ban command:', e);
            await message.reply(`❌ An error occurred while banning the user: ${e.message}`);
        }
    }
    if (command === 'unban') {
        try {
            const hasPermission = message.author.id === client.user.id ||
                (message.member && message.member.permissions.has(PFB.BanMembers));

            if (!hasPermission) {
                return message.reply('🚫 You do not have permission to unban members.');
            }
            let targetUser = null;
            let userId = null;
            if (args[0]) {
                const mentionMatch = args[0].match(/^<@!?(\d+)>$/);
                if (mentionMatch) {
                    userId = mentionMatch[1];
                } else if (/^\d+$/.test(args[0])) {
                    userId = args[0];
                }
                if (userId) {
                    try {
                        targetUser = await client.users.fetch(userId);
                    } catch (error) {
                        return message.reply('⚠️ Could not find a user with that ID. Make sure the user ID is correct.');
                    }
                }
            }
            if (!targetUser) {
                return message.reply('⚠️ Specify a valid user to unban. Usage: `.unban <user_id|@user> [reason]`');
            }
            let bannedUser = null;
            try {
                const bans = await message.guild.bans.fetch();
                bannedUser = bans.get(targetUser.id);
            } catch (error) {
                return message.reply('❌ Could not fetch ban list. I may not have permission to view bans.');
            }
            if (!bannedUser) {
                return message.reply(`⚠️ ${targetUser.tag} is not currently banned from this server.`);
            }
            let reason = `No reason provided by ${message.author.tag}`;
            if (message.author.id === client.user.id) {
                reason = `No reason provided via livebot`;
            }
            if (args.length > 1) {
                reason = args.slice(1).join(' ');
                if (message.author.id === client.user.id) {
                    reason += ' (via livebot)';
                }
            }
            const unbanEmbed = new EB()
                .setColor(CFG.COLORS.SUCCESS)
                .setTitle('✅ User Unbanned')
                .setDescription(`${targetUser.tag} has been unbanned from the server.`)
                .addFields(
                    {name: '👤 User', value: `${targetUser.tag} (${targetUser.id})`, inline: true},
                    {name: '🔓 Moderator', value: `${message.author.tag} (${message.author.id})${message.author.id === client.user.id ? ' via livebot' : ''}`, inline: true},
                    {name: '📝 Reason', value: reason}
                )
                .setTimestamp()
                .setFooter({text: '🎮 MCBETIERS Moderation'});
            try {
                const dmEmbed = new EB()
                    .setColor(CFG.COLORS.SUCCESS)
                    .setTitle(`✅ You Have Been Unbanned`)
                    .setDescription(`You have been unbanned from ${message.guild.name}`)
                    .addFields(
                        {name: '📝 Reason', value: reason},
                        {name: '🔓 Unbanned By', value: `${message.author.tag}${message.author.id === client.user.id ? ' (via livebot)' : ''}`}
                    )
                    .setTimestamp()
                    .setFooter({text: '🎮 MCBETIERS System'});
                await targetUser.send({embeds: [dmEmbed]}).catch(() => {
                });
            } catch (e) {
                console.log(`Could not send DM to ${targetUser.tag}: ${e.message}`);
            }
            const caseId = await h.logAction(message.guild, 'unban', message.author, targetUser, reason);
            await message.guild.members.unban(targetUser, `${reason} (Case #${caseId})`);
            await message.reply({
                content: `✅ Successfully unbanned ${targetUser.tag}`,
                embeds: [unbanEmbed]
            });
            const logChannel = await message.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) {
                await logChannel.send({embeds: [unbanEmbed]});
            }
        } catch (e) {
            console.error('Error in .unban command:', e);
            await message.reply(`❌ An error occurred while unbanning the user: ${e.message}`);
        }
    }
    if (command === 'marcus') {
        try {
            await message.reply('steven here');
        } catch (e) {
            console.error('Error in .marcus command:', e);
            await message.reply(`❌ An error occurred: ${e.message}`);
        }
    }
    if (command === 'morad') {
        try {
            await message.reply('💔🥀🥀🥀💔');
        } catch (e) {
            console.error('Error in .morad command:', e);
            await message.reply(`❌ An error occurred: ${e.message}`);
        }
    }
    if (command === 'rwu') {
        try {
            await message.reply('has low kb');
        } catch (e) {
            console.error('Error in .rwu command:', e);
            await message.reply(`❌ An error occurred: ${e.message}`);
        }
    }
    if (command === 'darryn') {
        try {
            await message.reply('life and we are unemployed😔');
        } catch (e) {
            console.error('Error in .darryn command:', e);
            await message.reply(`❌ An error occurred: ${e.message}`);
        }
    }

    if (command === 'craig') {
        try {
            await message.reply('');
        } catch (e) {
            console.error('Error in .craig command:', e);
            await message.reply(`❌ An error occurred: ${e.message}`);
        }
    }
});
client.on(E.InteractionCreate, async(i) => {
    if(!i.isCommand()) return;
    const {commandName: cmd} = i;

    try {
        const SUPERUSER_ID = '510847369454026753';

        if(i.user.id !== SUPERUSER_ID && !h.hasPermission(i.member, cmd)) {
            await i.reply({content:'🚫 You do not have permission to use this command.', ephemeral: true});
            return;
        }
        switch(cmd){
            case'ping':{
                const s=Date.now();
                const r=await i.reply({content:'🏓 Pinging...',fetchReply:true});
                const a=Date.now()-s;
                await i.editReply({content:null,embeds:[new EB().setColor(CFG.COLORS.PRIMARY).setTitle('🏓 Pong!').addFields({name:'📶 API Latency',value:`${a}ms`,inline:true},{name:'🌐 WebSocket Latency',value:`${client.ws.ping}ms`,inline:true},{name:'🤖 Bot Status',value:'Online and operational',inline:true}).setTimestamp().setFooter({text:'🎮 MCBETIERS System'})]});
                break;
            }

            case 'queue-status': {
                const requestedRegion = i.options.getString('region');
                const db = readDB();
                const categoryId = '1362088376198627518';

                if (!db.queues[categoryId]) {
                    await i.reply({
                        content: '❌ No queue data found.',
                        ephemeral: true
                    });
                    break;
                }

                const embed = new EB()
                    .setColor('#00ffff')
                    .setTitle('📊 Queue Status')
                    .setTimestamp()
                    .setFooter({ text: '🎮 MCBETIERS Queue System' });

                const regions = requestedRegion ? [requestedRegion] : ['AS', 'EU', 'NA'];

                for (const region of regions) {
                    const queue = db.queues[categoryId][region] || [];
                    const activeTickets = Object.values(db.activeTickets).filter(
                        ticket => ticket.categoryId === categoryId && ticket.region === region
                    ).length;

                    const priorityCount = queue.filter(entry => entry.priority).length;
                    const regularCount = queue.length - priorityCount;

                    let queueList = '';
                    if (queue.length === 0) {
                        queueList = 'Empty';
                    } else {
                        const preview = queue.slice(0, 5).map((entry, index) => {
                            const priority = entry.priority ? '⭐' : '👤';
                            return `${index + 1}. ${priority} ${entry.username}`;
                        }).join('\n');

                        queueList = preview;
                        if (queue.length > 5) {
                            queueList += `\n... and ${queue.length - 5} more`;
                        }
                    }

                    embed.addFields({
                        name: `🌍 ${region} Region`,
                        value: `**Active Tickets:** ${activeTickets}/10\n` +
                            `**Queue Length:** ${queue.length}\n` +
                            `**Priority:** ${priorityCount} | **Regular:** ${regularCount}\n` +
                            `**Queue:**\n${queueList}`,
                        inline: false
                    });
                }

                await i.reply({
                    embeds: [embed],
                    ephemeral: true
                });

                break;
            }

            case 'ticketembed': {
                let hasReplied = false;

                try {
                    if (!i.member.roles.cache.has('1368972575543136397')) {
                        await i.reply({
                            content: '❌ You do not have permission to use this command.',
                            flags: 64 
                        });
                        hasReplied = true;
                        break;
                    }
                    const categoryId = i.options.getString('category');
                    const name = i.options.getString('name');
                    const description = i.options.getString('description');
                    const buttonName = i.options.getString('button_name');
                    const prompts = i.options.getString('prompts') || '';
                    const promptsArray = [];
                    if (prompts) {
                        const matches = prompts.match(/\d+(st|nd|rd|th)\s+query=([^0-9]+?)(?=\d+(st|nd|rd|th)\s+query=|$)/gi);

                        if (matches) {
                            for (const match of matches) {
                                const queryMatch = match.match(/query=(.+)/i);
                                if (queryMatch) {
                                    const prompt = queryMatch[1].trim();
                                    if (prompt) {
                                        promptsArray.push(prompt);
                                    }
                                }
                            }
                        }
                    }
                    console.log('Input prompts string:', prompts);
                    console.log('Parsed prompts:', promptsArray);
                    const embed = new EB()
                        .setColor(CFG.COLORS.PRIMARY)
                        .setTitle(name)
                        .setDescription(description)
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS Ticket System' });
                    const configId = `ticket_${categoryId}`;
                    const button = new ButtonBuilder()
                        .setCustomId(configId)
                        .setLabel(buttonName)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎫');
                    const row = new ActionRowBuilder().addComponents(button);
                    const db = readDB();
                    if (!db.ticketConfigs) db.ticketConfigs = {};
                    db.ticketConfigs[configId] = {
                        categoryId,
                        name,
                        prompts: promptsArray
                    };
                    console.log('Saving config:', db.ticketConfigs[configId]);
                    writeDB(db);
                    await i.reply({
                        embeds: [embed],
                        components: [row]
                    });
                    hasReplied = true;
                } catch (error) {
                    console.error('Error in ticketembed command:', error);
                    if (!hasReplied && !i.replied && !i.deferred) {
                        try {
                            await i.reply({
                                content: '❌ An error occurred while creating the ticket embed.',
                                flags: 64
                            });
                        } catch (replyError) {
                            console.error('Could not send error reply:', replyError);
                        }
                    }
                }

                break;
            }
            case 'stafflogs': {
                const STAFF_ROLE_ID = '1362075029990412398';
                if (!i.member || !i.member.roles.cache.has(STAFF_ROLE_ID)) {
                    await i.reply({
                        embeds: [new EB()
                            .setColor(0xFF0000)
                            .setTitle('❌ Access Denied')
                            .setDescription('You do not have permission to use this command.')
                            .setFooter({ text: '🎮 MCBETIERS System' })
                            .setTimestamp()
                        ],
                        ephemeral: true
                    });
                    break;
                }
                const staffUser = i.options.getUser('staff');
                const filterType = i.options.getString('type') || 'all';
                await i.deferReply();
                try {
                    const fs = require('fs');
                    const logsData = JSON.parse(fs.readFileSync('./moderation_logs.json', 'utf8'));

                    let staffActions = [];

                    for (const userId in logsData) {
                        const userLogs = logsData[userId];

                        userLogs.forEach(log => {
                            if (log.moderatorId === staffUser.id) {
                                if (filterType === 'all' || log.type === filterType) {
                                    staffActions.push({
                                        ...log,
                                        targetUserId: userId
                                    });
                                }
                            }
                        });
                    }
                    staffActions.sort((a, b) => b.timestamp - a.timestamp);

                    if (staffActions.length === 0) {
                        await i.editReply({
                            embeds: [new EB()
                                .setColor(0xFFFF00)
                                .setTitle('📋 Staff Logs')
                                .setDescription(`No moderation actions found for ${staffUser.tag}${filterType !== 'all' ? ` (${filterType})` : ''}`)
                                .setFooter({ text: '🎮 MCBETIERS System' })
                                .setTimestamp()
                            ]
                        });
                        break;
                    }
                    const totalActions = staffActions.length;
                    const actionsByType = staffActions.reduce((acc, action) => {
                        acc[action.type] = (acc[action.type] || 0) + 1;
                        return acc;
                    }, {});
                    let description = `**Total Actions:** ${totalActions}\n`;
                    Object.entries(actionsByType).forEach(([type, count]) => {
                        description += `**${type}s:** ${count}\n`;
                    });
                    description += '\n**Recent Actions:**\n';
                    const recentActions = staffActions.slice(0, 10);
                    recentActions.forEach((action, index) => {
                        const date = new Date(action.timestamp).toLocaleDateString();
                        const time = new Date(action.timestamp).toLocaleTimeString();
                        description += `${index + 1}. **${action.type}** - <@${action.targetUserId}>\n`;
                        description += `   Case: \`${action.caseId}\` | ${date} ${time}\n`;
                        description += `   Reason: ${action.reason}\n`;
                        if (action.duration) description += `   Duration: ${action.duration}\n`;
                        description += '\n';
                    });

                    if (staffActions.length > 10) {
                        description += `*... and ${staffActions.length - 10} more actions*`;
                    }

                    await i.editReply({
                        embeds: [new EB()
                            .setColor(0x00FF00)
                            .setTitle(`📋 Staff Logs - ${staffUser.tag}`)
                            .setDescription(description)
                            .setThumbnail(staffUser.displayAvatarURL())
                            .setFooter({ text: '🎮 MCBETIERS System' })
                            .setTimestamp()
                        ]
                    });

                } catch (error) {
                    await i.editReply({
                        embeds: [new EB()
                            .setColor(0xFF0000)
                            .setTitle('❌ Error')
                            .setDescription(`Failed to read moderation logs: ${error.message}`)
                            .setFooter({ text: '🎮 MCBETIERS System' })
                            .setTimestamp()
                        ]
                    });
                }

                break;
            }

            case'eval':{
                const EVAL_ROLE_ID = '1379433661497086024';
                if(!i.member || !i.member.roles.cache.has(EVAL_ROLE_ID)){
                    await i.reply({embeds:[new EB().setColor(0xFF0000).setTitle('❌ Access Denied').setDescription('You do not have permission to use this command, If you think this is wrong, Contact @whoseqou2').setFooter({text:'🎮 MCBETIERS System'}).setTimestamp()],ephemeral:true});
                    break;
                }

                const code = i.options.getString('code');
                await i.deferReply();

                let result;
                let success = true;
                const startTime = Date.now();

                try{
                    result = eval(code);
                    if(result instanceof Promise) result = await result;
                    if(typeof result !== 'string') result = require('util').inspect(result,{depth:2});
                }catch(error){
                    success = false;
                    result = error.toString();
                }

                const executionTime = Date.now() - startTime;

                if(result.length > 2000) result = result.substring(0,2000) + '\n... (truncated)';

                await i.editReply({embeds:[new EB().setColor(success ? 0x00FF00 : 0xFF0000).setTitle(success ? '✅ Code Executed Successfully' : '❌ Execution Error').addFields({name:'📝 Input Code',value:`\`\`\`javascript\n${code.length > 1000 ? code.substring(0,1000) + '\n... (truncated)' : code}\`\`\``,inline:false},{name:success ? '📤 Output' : '🚫 Error',value:`\`\`\`\n${result || 'undefined'}\`\`\``,inline:false},{name:'⏱️ Execution Time',value:`${executionTime}ms`,inline:true}).setFooter({text:'🎮 MCBETIERS System'}).setTimestamp()]});
                break;
            }
            case'purge':{
                const a=i.options.getInteger('amount');
                const t=i.options.getUser('user');
                const r=i.options.getString('reason')||`Bulk message deletion by ${i.user.tag}`;
                await i.deferReply({ephemeral:true});
                try{
                    const m=await i.channel.messages.fetch({limit:100});
                    let d=m.filter(m=>Date.now()-m.createdTimestamp<14*24*60*60*1000);
                    if(t)d=d.filter(m=>m.author.id===t.id);
                    d=d.first(a);
                    if(d.length===0)return i.editReply({content:'❌ No eligible messages found to delete. Messages must be newer than 14 days.',ephemeral:true});
                    await i.channel.bulkDelete(d,true).catch(e=>{console.error('Error deleting messages:',e);throw new Error('Failed to delete messages. They may be too old (>14 days).');});
                    const e=new EB().setColor(CFG.COLORS.WARNING).setTitle('🧹 Messages Purged').setDescription(`Successfully deleted ${d.length} message(s) in <#${i.channel.id}>`).addFields({name:'📝 Reason',value:r},{name:'🔨 Moderator',value:i.user.tag},{name:'📊 Target',value:t?`${t.tag}`:'All users'},{name:'🗑️ Amount',value:`${d.length} message(s)`}).setTimestamp().setFooter({text:'🎮 MCBETIERS Moderation'});
                    await i.editReply({content:`Successfully purged ${d.length} message(s)`,ephemeral:true});
                    const l=await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(()=>null);
                    if(l)await l.send({embeds:[e]});
                    await i.channel.send({embeds:[e]});
                }catch(e){console.error('Purge command error:',e);await i.editReply({content:`❌ Error purging messages: ${e.message}`,ephemeral:true});}
                break;
            }

            case 'cheater-add': {
                try {
                    const ign = i.options.getString('ign');
                    const discord = i.options.getString('discord');
                    const userId = i.options.getString('user_id');
                    const cheatsUsed = i.options.getString('cheats_used');
                    const date = i.options.getString('date');
                    const caughtBy = i.options.getString('caught_by');
                    const positive = i.options.getString('positive');
                    const comment = i.options.getString('comment');
                    const reportNumber = i.options.getInteger('report_number');
                    const evidence = i.options.getAttachment('evidence');

                    const cheaterEmbed = new EB()
                        .setColor('#2B2D31')
                        .setAuthor({ name: `MCBETIERS Cheater Report #${reportNumber}` })
                        .setThumbnail('attachment://logo.png')
                        .addFields(
                            {
                                name: 'IGN',
                                value: ign,
                                inline: true
                            },
                            {
                                name: 'Discord',
                                value: discord,
                                inline: true
                            },
                            {
                                name: 'User ID',
                                value: userId,
                                inline: true
                            },
                            {
                                name: 'Cheats Used',
                                value: cheatsUsed,
                                inline: false
                            },
                            {
                                name: 'Date',
                                value: date,
                                inline: true
                            },
                            {
                                name: 'Caught By',
                                value: caughtBy,
                                inline: true
                            },
                            {
                                name: 'Positive?',
                                value: positive,
                                inline: true
                            },
                            {
                                name: 'Comment',
                                value: `"${comment}"`,
                                inline: false
                            }
                        );

                    const files = [{
                        attachment: './assets/logo.png',
                        name: 'logo.png'
                    }];

                    if (evidence) {
                        cheaterEmbed.addFields({
                            name: 'Evidence',
                            value: `[View Evidence](${evidence.url})`,
                            inline: false
                        });

                        const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
                        const fileExtension = evidence.name.split('.').pop().toLowerCase();

                        if (imageTypes.includes(fileExtension)) {
                            cheaterEmbed.setImage(evidence.url);
                        }
                    }

                    await i.reply({
                        embeds: [cheaterEmbed],
                        files: files,
                        content: evidence && !(['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(evidence.name.split('.').pop().toLowerCase())) ?
                            `Video evidence: ${evidence.url}` : null
                    });

                    console.log(`Cheater report #${reportNumber} created for ${ign}`);
                } catch (error) {
                    console.error('Error creating cheater report:', error);
                    await i.reply({
                        content: `Error creating cheater report: ${error.message}`,
                        ephemeral: true
                    });
                }
                break;
            }
            case 'add': {
                const targetUser = i.options.getUser('user');
                const region = i.options.getString('region');
                const gamemode = i.options.getString('gamemode');
                const tier = i.options.getString('tier');
                if (!i.member.roles.cache.has(CFG.SUPPORT_TEAM_ROLE_ID) && !i.member.roles.cache.has(CFG.OWNER_ROLE_ID)) {
                    await i.reply({ content: '🚫 You need tester permissions to add players to tier lists.', ephemeral: true });
                    return;
                }

                await i.deferReply();

                try {
                    await addPlayerToTierList(targetUser.id, targetUser.username, region, gamemode, tier);
                    let roleAssigned = false;
                    try {
                        const roleId = ROLE_IDS[gamemode]?.[tier.toUpperCase()];
                        if (roleId) {
                            const member = await i.guild.members.fetch(targetUser.id).catch(() => null);
                            if (member) {
                                await member.roles.add(roleId);
                                roleAssigned = true;
                            }
                        }
                    } catch (roleError) {
                        console.error('Error assigning role:', roleError);
                    }
                    const successEmbed = new EB()
                        .setColor(CFG.COLORS.SUCCESS)
                        .setTitle('✅ Player Added to Tier List')
                        .setDescription(`Successfully added ${targetUser.username} to the tier list!`)
                        .addFields(
                            { name: '👤 Player', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                            { name: '🌍 Region', value: region.toUpperCase(), inline: true },
                            { name: '🎮 Gamemode', value: gamemode === 'index' ? 'Main/Overall' : gamemode, inline: true },
                            { name: '🏆 Tier', value: tier.toUpperCase(), inline: true },
                            { name: '🔗 Website', value: `[View Tier List](https://mcbetiers.com/${gamemode === 'index' ? '' : gamemode + '.html'})`, inline: true },
                            { name: '🎭 Discord Role', value: roleAssigned ? '✅ Assigned' : '❌ Not available', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS System' });
                    await i.editReply({ embeds: [successEmbed] });
                    const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        const logEmbed = new EB()
                            .setColor(CFG.COLORS.INFO)
                            .setTitle('📝 Tier List Update')
                            .setDescription(`Player added to tier list by ${i.user.tag}`)
                            .addFields(
                                { name: '👤 Player Added', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                                { name: '🌍 Region', value: region.toUpperCase(), inline: true },
                                { name: '🎮 Gamemode', value: gamemode === 'index' ? 'Main/Overall' : gamemode, inline: true },
                                { name: '🏆 Tier', value: tier.toUpperCase(), inline: true },
                                { name: '👨‍💼 Added By', value: `${i.user.tag} (${i.user.id})`, inline: true },
                                { name: '🎭 Role Assigned', value: roleAssigned ? 'Yes' : 'No', inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: '🎮 MCBETIERS System' });
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (error) {
                    console.error('Error adding player to tier list:', error);
                    const errorEmbed = new EB()
                        .setColor(CFG.COLORS.DANGER)
                        .setTitle('❌ Error Adding Player')
                        .setDescription('Failed to add player to tier list. Please check the logs for more details.')
                        .addFields(
                            { name: '🐛 Error Details', value: error.message || 'Unknown error occurred' }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS System' });
                    await i.editReply({ embeds: [errorEmbed] });
                }

                break;
            }
            case 'remove': {
                const targetUser = i.options.getUser('user');
                const gamemode = i.options.getString('gamemode');
                if (!i.member.roles.cache.has(CFG.SUPPORT_TEAM_ROLE_ID) && !i.member.roles.cache.has(CFG.OWNER_ROLE_ID)) {
                    await i.reply({ content: '🚫 You need tester permissions to remove players from tier lists.', ephemeral: true });
                    return;
                }

                await i.deferReply();

                try {
                    const removedPlayer = await removePlayerFromTierList(targetUser.id, gamemode);
                    let rolesRemoved = [];
                    try {
                        const member = await i.guild.members.fetch(targetUser.id).catch(() => null);
                        if (member && ROLE_IDS[gamemode]) {
                            for (const [tierName, roleId] of Object.entries(ROLE_IDS[gamemode])) {
                                if (roleId && roleId !== 'ROLE_ID_HERE' && member.roles.cache.has(roleId)) {
                                    await member.roles.remove(roleId);
                                    rolesRemoved.push(tierName);
                                }
                            }
                        }
                    } catch (roleError) {
                        console.error('Error removing roles:', roleError);
                    }

                    const successEmbed = new EB()
                        .setColor(CFG.COLORS.SUCCESS)
                        .setTitle('✅ Player Removed from Tier List')
                        .setDescription(`Successfully removed ${targetUser.username} from the tier list!`)
                        .addFields(
                            { name: '👤 Player', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                            { name: '🌍 Region', value: removedPlayer.region || 'Unknown', inline: true },
                            { name: '🎮 Gamemode', value: gamemode === 'index' ? 'Main/Overall' : gamemode, inline: true },
                            { name: '🏆 Previous Tier', value: removedPlayer.tier || 'Unknown', inline: true },
                            { name: '🔗 Website', value: `[View Tier List](https://mcbetiers.com/${gamemode === 'index' ? '' : gamemode + '.html'})`, inline: true },
                            { name: '🎭 Discord Roles', value: rolesRemoved.length > 0 ? `✅ Removed: ${rolesRemoved.join(', ')}` : '❌ None removed', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS System' });

                    await i.editReply({ embeds: [successEmbed] });
                    const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        const logEmbed = new EB()
                            .setColor(CFG.COLORS.INFO)
                            .setTitle('📝 Tier List Update')
                            .setDescription(`Player removed from tier list by ${i.user.tag}`)
                            .addFields(
                                { name: '👤 Player Removed', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                                { name: '🌍 Region', value: removedPlayer.region || 'Unknown', inline: true },
                                { name: '🎮 Gamemode', value: gamemode === 'index' ? 'Main/Overall' : gamemode, inline: true },
                                { name: '🏆 Previous Tier', value: removedPlayer.tier || 'Unknown', inline: true },
                                { name: '👨‍💼 Removed By', value: `${i.user.tag} (${i.user.id})`, inline: true },
                                { name: '🎭 Roles Removed', value: rolesRemoved.length > 0 ? rolesRemoved.join(', ') : 'None', inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: '🎮 MCBETIERS System' });

                        await logChannel.send({ embeds: [logEmbed] });
                    }

                } catch (error) {
                    console.error('Error removing player from tier list:', error);

                    const errorEmbed = new EB()
                        .setColor(CFG.COLORS.DANGER)
                        .setTitle('❌ Error Removing Player')
                        .setDescription('Failed to remove player from tier list. Please check the logs for more details.')
                        .addFields(
                            { name: '🐛 Error Details', value: error.message || 'Unknown error occurred' }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS System' });

                    await i.editReply({ embeds: [errorEmbed] });
                }

                break;
            }

            case 'role-add': {
                const AUTHORIZED_USER_IDS = [
                    '689089806478868514',
                    '1403336702247829594',
                    '510847369454026753'
                ];
                const RESTRICTED_ROLE_IDS = [
                    '1379433661497086024',
                    '1362075171267023040',
                    '1362082670947074208'
                ];
                await i.deferReply();
                try {
                    const targetUser = i.options.getUser('user');
                    const targetMember = await i.guild.members.fetch(targetUser.id).catch(() => null);
                    const role = i.options.getRole('role');
                    if (!targetMember) {
                        await i.editReply({
                            content: '❌ Could not find that user in this server.'
                        });
                        return;
                    }
                    if (!role) {
                        await i.editReply({
                            content: '❌ Could not find that role.'
                        });
                        return;
                    }
                    if (RESTRICTED_ROLE_IDS.includes(role.id)) {
                        if (!AUTHORIZED_USER_IDS.includes(i.user.id)) {
                            await i.editReply({
                                content: '🚫 This role can only be assigned by authorized personnel.',
                                ephemeral: true
                            });
                            return;
                        }
                    } else {
                        if (!i.member.permissions.has(PFB.Administrator)) {
                            await i.reply({
                                content: '🚫 You need Administrator permission to use this command.',
                                ephemeral: true
                            });
                            return;
                        }
                    }
                    if (!role.editable) {
                        await i.editReply({
                            content: '❌ I cannot add this role. It may be higher than my highest role or be the @everyone role.'
                        });
                        return;
                    }
                    if (targetMember.roles.cache.has(role.id)) {
                        await i.editReply({
                            content: `❌ ${targetUser} already has the ${role} role.`
                        });
                        return;
                    }
                    await targetMember.roles.add(role);
                    const resultEmbed = new EB()
                        .setColor(role.color || '#55FF55')
                        .setTitle('✅ Role Added')
                        .setDescription(`Successfully added a role to ${targetUser}`)
                        .addFields(
                            {name: '👤 User', value: `${targetUser} (${targetUser.tag})`, inline: true},
                            {name: '🏷️ Role Added', value: `${role.name}`, inline: true},
                            {name: '👮 Added By', value: `${i.user} (${i.user.tag})`, inline: true}
                        )
                        .setTimestamp()
                        .setFooter({text: '🎮 MCBETIERS System'});

                    const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        await logChannel.send({embeds: [resultEmbed]});
                    }

                    await i.editReply({
                        content: `✅ Successfully added the ${role} role to ${targetUser}`,
                        embeds: [resultEmbed]
                    });

                } catch(e) {
                    console.error('Error in role-add command:', e);
                    await i.editReply({
                        content: `❌ An error occurred while adding the role: ${e.message}`
                    });
                }
                break;
            }
            case 'rolecolor': {
                if (!i.member.permissions.has(PFB.Administrator)) {
                    await i.reply({
                        content: '🚫 You need Administrator permission to use this command.',
                        ephemeral: true
                    });
                    return;
                }

                await i.deferReply();

                try {
                    const role = i.options.getRole('role');
                    const colorInput = i.options.getString('color');

                    const colorRegex = /^#?([0-9A-Fa-f]{6})$/;
                    const match = colorInput.match(colorRegex);

                    if (!match) {
                        await i.editReply({
                            content: '❌ Invalid color format. Please use a valid hex color code (e.g. #FF0000 for red).'
                        });
                        return;
                    }

                    const colorHex = match[1];
                    const colorInt = parseInt(colorHex, 16);

                    if (!role.editable) {
                        await i.editReply({
                            content: '❌ I cannot modify this role. It may be higher than my highest role or be the @everyone role.'
                        });
                        return;
                    }
                    const oldColorHex = role.color.toString(16).padStart(6, '0');
                    await role.setColor(colorInt);

                    const resultEmbed = new EB()
                        .setColor(colorInt)
                        .setTitle('🎨 Role Color Changed')
                        .setDescription(`Successfully changed the color of ${role}`)
                        .addFields(
                            {name: '🏷️ Role', value: `${role.name}`, inline: true},
                            {name: '🔄 Old Color', value: `#${oldColorHex.toUpperCase()}`, inline: true},
                            {name: '🆕 New Color', value: `#${colorHex.toUpperCase()}`, inline: true},
                            {name: '👮 Changed By', value: `${i.user} (${i.user.tag})`, inline: true}
                        )
                        .setTimestamp()
                        .setFooter({text: '🎮 MCBETIERS System'});

                    const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        await logChannel.send({embeds: [resultEmbed]});
                    }

                    await i.editReply({
                        content: `✅ Changed the color of ${role} to #${colorHex.toUpperCase()}`,
                        embeds: [resultEmbed]
                    });

                } catch(e) {
                    console.error('Error in rolecolor command:', e);
                    await i.editReply({
                        content: `❌ An error occurred while changing the role color: ${e.message}`
                    });
                }
                break;
            }
            case 'role-remove': {
                if (!i.member.permissions.has(PFB.Administrator)) {
                    await i.reply({
                        content: '🚫 You need Administrator permission to use this command.',
                        ephemeral: true
                    });
                    return;
                }

                await i.deferReply();

                try {
                    const targetUser = i.options.getUser('user');
                    const targetMember = await i.guild.members.fetch(targetUser.id).catch(() => null);
                    const role = i.options.getRole('role');

                    const PROTECTED_USER_IDS = [
                        '510847369454026753', //qou2
                        '234567890123456789', //future
                        '1345804426950086682', //evil
                        '1355245770453946399',    //morad
                        '739675729310121994' //kruize
                    ];

                    if (PROTECTED_USER_IDS.includes(targetUser.id)) {
                        await i.editReply({
                            content: '⚠️ This user is protected and cannot have roles removed via this command.'
                        });
                        return;
                    }

                    if (!targetMember) {
                        await i.editReply({
                            content: '❌ Could not find that user in this server.'
                        });
                        return;
                    }

                    if (!role) {
                        await i.editReply({
                            content: '❌ Could not find that role.'
                        });
                        return;
                    }

                    if (!role.editable) {
                        await i.editReply({
                            content: '❌ I cannot remove this role. It may be higher than my highest role or be the @everyone role.'
                        });
                        return;
                    }

                    if (!targetMember.roles.cache.has(role.id)) {
                        await i.editReply({
                            content: `❌ ${targetUser} does not have the ${role} role.`
                        });
                        return;
                    }

                    await targetMember.roles.remove(role);

                    const resultEmbed = new EB()
                        .setColor('#FF5555')
                        .setTitle('🚫 Role Removed')
                        .setDescription(`Successfully removed a role from ${targetUser}`)
                        .addFields(
                            {name: '👤 User', value: `${targetUser} (${targetUser.tag})`, inline: true},
                            {name: '🏷️ Role Removed', value: `${role.name}`, inline: true},
                            {name: '👮 Removed By', value: `${i.user} (${i.user.tag})`, inline: true}
                        )
                        .setTimestamp()
                        .setFooter({text: '🎮 MCBETIERS System'});

                    const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        await logChannel.send({embeds: [resultEmbed]});
                    }

                    await i.editReply({
                        content: `✅ Successfully removed the ${role} role from ${targetUser}`,
                        embeds: [resultEmbed]
                    });

                } catch(e) {
                    console.error('Error in role-remove command:', e);
                    await i.editReply({
                        content: `❌ An error occurred while removing the role: ${e.message}`
                    });
                }
                break;
            }

            case'uptime':{
                const u=Date.now()-BOT_START_TIME;
                await i.reply({embeds:[new EB().setColor(CFG.COLORS.PRIMARY).setTitle('⏱️ Bot Uptime').setDescription(`I've been online for **${h.formatUptime(u)}**`).addFields({name:'🚀 Started At',value:`<t:${Math.floor(BOT_START_TIME/1000)}:F>`,inline:true},{name:'🔄 Current Time',value:`<t:${Math.floor(Date.now()/1000)}:F>`,inline:true}).setTimestamp().setFooter({text:'🎮 MCBETIERS System'})]});
                break;
            }
            case 'unmute': {
                if (!i.member.roles.cache.has(CFG.MODERATOR_ROLE_ID) && !i.member.roles.cache.has(CFG.SUPPORT_TEAM_ROLE_ID)) {
                    await i.reply({
                        content: '🚫 You do not have permission to use this command.',
                        ephemeral: true
                    });
                    return;
                }

                await i.deferReply();

                try {
                    const targetUser = i.options.getMember('user');
                    const reason = i.options.getString('reason') || 'No reason provided';

                    if (!targetUser) {
                        await i.editReply({
                            content: '❌ Could not find that user in this server.'
                        });
                        return;
                    }

                    if (!targetUser.communicationDisabledUntil) {
                        await i.editReply({
                            content: `❌ ${targetUser} is not currently timed out.`
                        });
                        return;
                    }

                    if (!targetUser.manageable) {
                        await i.editReply({
                            content: `❌ I don't have permission to manage ${targetUser}. They may have a higher role than me.`
                        });
                        return;
                    }

                    await targetUser.timeout(null, reason);

                    const caseId = await h.logAction(
                        i.guild,
                        'unmute',
                        {
                            id: i.user.id,
                            tag: i.user.tag
                        },
                        targetUser,
                        reason
                    );

                    const resultEmbed = new EB()
                        .setColor(CFG.COLORS.SUCCESS)
                        .setTitle('🔊 Timeout Removed')
                        .setDescription(`Successfully removed timeout from ${targetUser}`)
                        .addFields(
                            {name: '👤 User', value: `${targetUser} (${targetUser.user.tag})`, inline: true},
                            {name: '🔨 Moderator', value: `${i.user} (${i.user.tag})`, inline: true},
                            {name: '📝 Reason', value: reason, inline: false},
                            {name: '🔢 Case ID', value: caseId || 'Unknown', inline: true}
                        )
                        .setTimestamp()
                        .setFooter({text: '🎮 MCBETIERS System'});

                    await i.editReply({
                        content: `✅ Removed timeout from ${targetUser}`,
                        embeds: [resultEmbed]
                    });

                    try {
                        const dmEmbed = new EB()
                            .setColor(CFG.COLORS.SUCCESS)
                            .setTitle(`🔊 Timeout Removed in ${i.guild.name}`)
                            .setDescription('Your timeout has been removed')
                            .addFields(
                                {name: '🔨 Moderator', value: i.user.tag, inline: true},
                                {name: '📝 Reason', value: reason, inline: true}
                            )
                            .setTimestamp()
                            .setFooter({text: '🎮 MCBETIERS System'});

                        await targetUser.send({embeds: [dmEmbed]});
                    } catch(e) {
                        console.log(`Could not send DM to ${targetUser.user.tag}: ${e.message}`);
                    }

                } catch(e) {
                    console.error('Error in unmute command:', e);
                    await i.editReply({
                        content: `❌ An error occurred while removing the timeout: ${e.message}`
                    });
                }
                break;
            }

            case'membercount':{
                const targetGuildId='1362072291340718151';
                const targetGuild=client.guilds.cache.get(targetGuildId);
                if(targetGuild){
                    await i.reply({embeds:[new EB().setColor(CFG.COLORS.INFO).setTitle('👥 Server Member Count').setDescription(`**${targetGuild.name}** currently has **${targetGuild.memberCount}** members`).setTimestamp().setFooter({text:'🎮 MCBETIERS System'})]});
                }else{
                    await i.reply({content:'❌ Unable to fetch member count for the specified server.',ephemeral:true});
                }
                break;
            }
            case 'elo': {
                try {
                    if (!i.deferred && !i.replied) {
                        await i.deferReply();
                    }
                    const targetUser = i.options.getUser('user') || i.user;
                    const member = await i.guild.members.fetch(targetUser.id).catch(() => null);
                    if (!member) {
                        return i.editReply({ content: '❌ Could not find that user in this server.' });
                    }
                    const TARGET_SERVER_ID = '1362072291340718151';
                    let eloData = {};
                    try {
                        if (fs.existsSync('./elo.json')) {
                            const data = fs.readFileSync('./elo.json', 'utf8');
                            eloData = JSON.parse(data);
                        }
                    } catch (err) {
                        console.error('Error reading ELO data:', err);
                        return i.editReply({ content: '❌ Error reading ELO data. Please try again later.' });
                    }

                    if (!eloData[member.id]) {
                        eloData[member.id] = {
                            userId: member.id,
                            username: member.user.username,
                            elo: 0,
                            weeklyHistory: []
                        };
                        try {
                            fs.writeFileSync('./elo.json', JSON.stringify(eloData, null, 2));
                        } catch (err) {
                            console.error('Error saving ELO data:', err);
                        }
                    }
                    const userElo = eloData[member.id].elo || 0;
                    const weeklyHistory = eloData[member.id].weeklyHistory || [];
                    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                    const recentChanges = weeklyHistory.filter(entry => entry.timestamp > oneWeekAgo);
                    const weeklyChange = recentChanges.reduce((sum, entry) => sum + entry.change, 0);
                    const gamemodes = ['skywars', 'midfight', 'bridge', 'sumo', 'nodebuff', 'builduhc', 'bedfight'];
                    const tierInfo = {};
                    try {
                        const targetGuild = await i.client.guilds.fetch(TARGET_SERVER_ID);
                        const targetMember = await targetGuild.members.fetch(targetUser.id).catch(() => null);

                        if (targetMember && typeof ROLE_IDS !== 'undefined') {
                            for (const gamemode of gamemodes) {
                                const tiers = ['S+', 'S', 'A', 'B', 'C', 'D', 'E'];
                                let foundTier = null;

                                for (const tier of tiers) {
                                    if (ROLE_IDS[gamemode] && ROLE_IDS[gamemode][tier] &&
                                        targetMember.roles.cache.has(ROLE_IDS[gamemode][tier])) {
                                        foundTier = tier;
                                        break;
                                    }
                                }

                                if (foundTier) {
                                    tierInfo[gamemode] = foundTier;
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching target server member:', err);
                    }
                    let eloRank = '';
                    let eloColor = '';
                    if (userElo >= 800) {
                        eloRank = '👑 God';
                        eloColor = '#FFD700';
                    } else if (userElo >= 700) {
                        eloRank = '💎 Goated';
                        eloColor = '#00FFFF';
                    } else if (userElo >= 600) {
                        eloRank = '🥇 Master';
                        eloColor = '#FFD700';
                    } else if (userElo >= 500) {
                        eloRank = '🥈 Pro';
                        eloColor = '#C0C0C0';
                    } else if (userElo >= 400) {
                        eloRank = '🥉 Skilled';
                        eloColor = '#CD853F';
                    } else if (userElo >= 300) {
                        eloRank = '🔰 Intermediate';
                        eloColor = '#9ACD32';
                    } else if (userElo >= 150) {
                        eloRank = '🟤 Novice';
                        eloColor = '#CD7F32';
                    } else {
                        eloRank = '⚫ Unranked';
                        eloColor = '#808080';
                    }
                    let recentActivity = [];
                    if (recentChanges.length > 0) {
                        recentActivity = recentChanges
                            .slice(-3)
                            .reverse()
                            .map(entry => {
                                const change = entry.change > 0 ? `+${entry.change}` : `${entry.change}`;
                                const date = new Date(entry.timestamp).toLocaleDateString();
                                return `${change} ELO • ${date}`;
                            });
                    }
                    let imageBuffer;
                    try {
                        if (typeof generateEloImage === 'function') {
                            imageBuffer = await generateEloImage(
                                {
                                    username: member.user.username,
                                    avatarURL: member.user.displayAvatarURL({ format: 'png', size: 256 })
                                },
                                {
                                    elo: userElo,
                                    rank: eloRank,
                                    color: eloColor,
                                    weeklyChange: weeklyChange,
                                    recentActivity: recentActivity
                                },
                                tierInfo
                            );
                            if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
                                throw new Error('generateEloImage did not return a valid buffer');
                            }
                        } else {
                            console.error('generateEloImage function not available');
                            return i.editReply({
                                content: `📊 **${member.user.username}'s ELO Profile**\n\n` +
                                    `**Rank:** ${eloRank}\n` +
                                    `**ELO:** ${userElo}\n` +
                                    `**Weekly Change:** ${weeklyChange > 0 ? '+' : ''}${weeklyChange}\n\n` +
                                    `*Image generation temporarily unavailable*`
                            });
                        }
                    } catch (imageError) {
                        console.error('Error generating image:', imageError);
                        return i.editReply({
                            content: `📊 **${member.user.username}'s ELO Profile**\n\n` +
                                `**Rank:** ${eloRank}\n` +
                                `**ELO:** ${userElo}\n` +
                                `**Weekly Change:** ${weeklyChange > 0 ? '+' : ''}${weeklyChange}\n\n` +
                                `*Image generation failed - showing text version*`
                        });
                    }
                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'elo-stats.png' });
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel('MCBETIERS')
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://discord.gg/npDmSF9hCp')
                                .setEmoji('🏆')
                        );
                    await i.editReply({
                        content: `📊 **${member.user.username}'s ELO Profile**`,
                        files: [attachment],
                        components: [row]
                    });

                } catch (error) {
                    console.error('Error in elo command:', error);
                    try {
                        if (!i.replied && !i.deferred) {
                            await i.reply({
                                content: '❌ An error occurred while processing the ELO command.',
                                flags: MessageFlags.Ephemeral
                            });
                        } else if (i.deferred) {
                            await i.editReply({ content: '❌ An error occurred while processing the ELO command.' });
                        }
                    } catch (responseError) {
                        console.error('Failed to send error response:', responseError);
                    }
                }
                break;
            }
            case 'elo-add': {
                const targetUser = i.options.getUser('user');
                const member = await i.guild.members.fetch(targetUser.id).catch(() => null);

                if (!member) {
                    return i.reply({ content: '❌ Could not find that user in this server.', ephemeral: true });
                }

                const eloAmount = i.options.getInteger('elo-amount');
                const adminUser = i.member.user.username;

                let eloData = {};
                try {
                    const fs = require('fs');
                    if (fs.existsSync('./elo.json')) {
                        const data = fs.readFileSync('./elo.json', 'utf8');
                        eloData = JSON.parse(data);
                    }
                } catch (err) {
                    console.error('Error reading ELO data:', err);
                    return i.reply({ content: '❌ Error reading ELO data.', ephemeral: true });
                }

                if (!eloData[member.id]) {
                    eloData[member.id] = {
                        userId: member.id,
                        username: member.user.username,
                        elo: 0,
                        weeklyHistory: []
                    };
                }
                const oldElo = eloData[member.id].elo || 0;
                eloData[member.id].elo = oldElo + eloAmount;
                const newElo = eloData[member.id].elo;
                if (!eloData[member.id].weeklyHistory) {
                    eloData[member.id].weeklyHistory = [];
                }
                eloData[member.id].weeklyHistory.push({
                    change: eloAmount,
                    timestamp: Date.now(),
                    admin: adminUser
                });
                const fourWeeksAgo = Date.now() - (28 * 24 * 60 * 60 * 1000);
                eloData[member.id].weeklyHistory = eloData[member.id].weeklyHistory.filter(
                    entry => entry.timestamp > fourWeeksAgo
                );
                try {
                    const fs = require('fs');
                    fs.writeFileSync('./elo.json', JSON.stringify(eloData, null, 2));
                } catch (err) {
                    console.error('Error saving ELO data:', err);
                    return i.reply({ content: '❌ Error saving ELO data.', ephemeral: true });
                }
                const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                const weeklyChanges = eloData[member.id].weeklyHistory.filter(entry => entry.timestamp > oneWeekAgo);
                const weeklyTotal = weeklyChanges.reduce((sum, entry) => sum + entry.change, 0);
                const logChannel = i.client.channels.cache.get('1371290274910965851');
                if (logChannel) {
                    const logEmbed = new EB()
                        .setColor('#00FF00')
                        .setTitle('📈 ELO Added')
                        .setDescription(`**${member.user.username}** gained **${eloAmount}** ELO`)
                        .addFields(
                            { name: 'Admin', value: adminUser, inline: true },
                            { name: 'Old ELO', value: `${oldElo}`, inline: true },
                            { name: 'New ELO', value: `${newElo}`, inline: true },
                            { name: 'Weekly Change', value: `${weeklyTotal > 0 ? '+' : ''}${weeklyTotal}`, inline: true },
                            { name: 'User ID', value: member.id, inline: true }
                        )
                        .setTimestamp();

                    logChannel.send({ embeds: [logEmbed] }).catch(error => console.error('Failed to send log message:', error));
                } else {
                    console.error('Could not find logging channel with ID 1371290274910965851');
                }
                await i.reply({
                    content: `✅ Added **${eloAmount}** ELO to ${member.user.username}.\n📊 **New Total:** ${newElo} ELO\n📈 **Weekly Change:** ${weeklyTotal > 0 ? '+' : ''}${weeklyTotal} ELO`
                });
                break;
            }
            case 'elo-remove': {
                const targetUser = i.options.getUser('user');
                const member = await i.guild.members.fetch(targetUser.id).catch(() => null);

                if (!member) {
                    return i.reply({ content: '❌ Could not find that user in this server.', ephemeral: true });
                }

                const eloAmount = i.options.getInteger('elo-amount');
                const adminUser = i.member.user.username;

                if (eloAmount <= 0) {
                    return i.reply({ content: '❌ Please provide a positive amount of ELO to remove.', ephemeral: true });
                }

                let eloData = {};
                try {
                    const fs = require('fs');
                    if (fs.existsSync('./elo.json')) {
                        const data = fs.readFileSync('./elo.json', 'utf8');
                        eloData = JSON.parse(data);
                    }
                } catch (err) {
                    console.error('Error reading ELO data:', err);
                    return i.reply({ content: '❌ Error reading ELO data.', ephemeral: true });
                }

                if (!eloData[member.id]) {
                    eloData[member.id] = {
                        userId: member.id,
                        username: member.user.username,
                        elo: 0,
                        weeklyHistory: []
                    };
                }
                const currentElo = eloData[member.id].elo || 0;
                const newElo = currentElo - eloAmount;
                eloData[member.id].elo = newElo;
                if (!eloData[member.id].weeklyHistory) {
                    eloData[member.id].weeklyHistory = [];
                }

                eloData[member.id].weeklyHistory.push({
                    change: -eloAmount,
                    timestamp: Date.now(),
                    admin: adminUser
                });
                const fourWeeksAgo = Date.now() - (28 * 24 * 60 * 60 * 1000);
                eloData[member.id].weeklyHistory = eloData[member.id].weeklyHistory.filter(
                    entry => entry.timestamp > fourWeeksAgo
                );
                try {
                    const fs = require('fs');
                    fs.writeFileSync('./elo.json', JSON.stringify(eloData, null, 2));
                } catch (err) {
                    console.error('Error saving ELO data:', err);
                    return i.reply({ content: '❌ Error saving ELO data.', ephemeral: true });
                }
                const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                const weeklyChanges = eloData[member.id].weeklyHistory.filter(entry => entry.timestamp > oneWeekAgo);
                const weeklyTotal = weeklyChanges.reduce((sum, entry) => sum + entry.change, 0);
                const logChannel = i.client.channels.cache.get('1371290274910965851');
                if (logChannel) {
                    const logEmbed = new EB()
                        .setColor('#FF0000')
                        .setTitle('📉 ELO Removed')
                        .setDescription(`**${member.user.username}** lost **${eloAmount}** ELO`)
                        .addFields(
                            { name: 'Admin', value: adminUser, inline: true },
                            { name: 'Old ELO', value: `${currentElo}`, inline: true },
                            { name: 'New ELO', value: `${newElo}`, inline: true },
                            { name: 'Weekly Change', value: `${weeklyTotal > 0 ? '+' : ''}${weeklyTotal}`, inline: true },
                            { name: 'User ID', value: member.id, inline: true }
                        )
                        .setTimestamp();

                    logChannel.send({ embeds: [logEmbed] }).catch(error => console.error('Failed to send log message:', error));
                } else {
                    console.error('Could not find logging channel with ID 1371290274910965851');
                }

                await i.reply({
                    content: `✅ Removed **${eloAmount}** ELO from ${member.user.username}.\n📊 **New Total:** ${newElo} ELO\n📈 **Weekly Change:** ${weeklyTotal > 0 ? '+' : ''}${weeklyTotal} ELO`
                });
                break;
            }
            case 'status': {
                try {
                    if (!i.deferred && !i.replied) {
                        await i.deferReply({ ephemeral: false });
                    }

                    const s = await h.getSystemInfo();
                    const si = i.guild;
                    const v = ['None', 'Low', 'Medium', 'High', 'Very High'][si.verificationLevel];

                    const embeds = [
                        new EB()
                            .setColor(CFG.COLORS.SUCCESS)
                            .setTitle(`📋 Server Information: ${si.name}`)
                            .setThumbnail(si.iconURL({ dynamic: true }))
                            .addFields(
                                { name: '👑 Owner', value: `<@${si.ownerId}>`, inline: true },
                                { name: '🆔 Server ID', value: si.id, inline: true },
                                { name: '📅 Created', value: `<t:${Math.floor(si.createdTimestamp / 1000)}:R>`, inline: true },
                                { name: '🛡️ Verification Level', value: v, inline: true },
                                { name: '👥 Members', value: `${si.memberCount}`, inline: true },
                                { name: '📺 Channels', value: `${si.channels.cache.size}`, inline: true },
                                { name: '🏷️ Roles', value: `${si.roles.cache.size}`, inline: true },
                                { name: '😀 Emojis', value: `${si.emojis.cache.size}`, inline: true },
                                { name: '🚀 Boosts', value: `${si.premiumSubscriptionCount} (Level ${si.premiumTier})`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: '🎮 MCBETIERS System' }),
                        new EB()
                            .setColor(CFG.COLORS.INFO)
                            .setTitle('🤖 Bot Status')
                            .addFields(
                                { name: '📡 Node.js Version', value: s.app.node, inline: true },
                                { name: '🔧 Discord.js Version', value: s.app.discordjs, inline: true },
                                { name: '⏲️ Bot Uptime', value: s.app.botUptime, inline: true },
                                { name: '🌍 Connected to', value: `${s.stats.guilds} server(s)`, inline: true },
                                { name: '📂 Total Channels', value: `${s.stats.channels}`, inline: true },
                                { name: '👥 Total Members', value: `${s.stats.members}`, inline: true },
                                { name: '🏷️ Total Roles', value: `${s.stats.roles}`, inline: true },
                                { name: '🎫 Active Tickets', value: `${s.stats.ticketChannels}`, inline: true },
                                { name: '📊 Moderation Records', value: `${s.stats.modLogCount}`, inline: true },
                                { name: '🔄 Process ID', value: `${s.process.pid}`, inline: true },
                                { name: '💻 Commands', value: `${s.stats.commands}`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: '🎮 MCBETIERS System' }),

                        new EB()
                            .setColor(CFG.COLORS.PRIMARY)
                            .setTitle('🖥️ System Status')
                            .addFields(
                                { name: '💻 Platform', value: '', inline: true },
                                { name: '🖧 Hostname', value: '', inline: true },
                                { name: '🔌 Network', value: '', inline: true },
                                { name: '⚙️ CPU', value: '', inline: true },
                                { name: '🧠 CPU Usage', value: s.os.cpuUsage, inline: true },
                                { name: '🔄 CPU Cores', value: '', inline: true },
                                { name: '📈 Load Average', value: ``, inline: false },
                                { name: '💾 Memory (Total)', value: s.os.memTotal, inline: true },
                                { name: '📊 Memory (Used)', value: s.os.memUsed, inline: true },
                                { name: '📈 Memory (Free)', value: s.os.memFree, inline: true },
                                { name: '🧠 Bot Memory', value: `RSS: ${s.process.memory.rss} MB | Heap: ${s.process.memory.heapUsed}/${s.process.memory.heapTotal} MB`, inline: false },
                                { name: '⏱️ System Uptime', value: s.os.uptime, inline: true },
                                { name: '💽 Disk Usage', value: `${s.os.disk}`, inline: true }
                            )
                            .setTimestamp()
                            .setFooter({ text: '🎮 MCBETIERS System' })
                    ];
                    await i.editReply({ content: '📊 Here is the current system status information:', embeds });
                } catch (e) {
                    console.error('Error in status command:', e);
                    try {
                        if (!i.replied) {
                            await i.editReply({ content: '❌ An error occurred while fetching system status.' });
                        }
                    } catch (innerErr) {
                        console.error('Failed to send error message:', innerErr);
                    }
                }
                break;
            }
            case'mute':{
                const t=i.options.getMember('user');
                if(!t)return i.reply({content:'❌ Could not find that user.',ephemeral:true});
                const ti=i.options.getString('duration');
                const d=h.parseTime(ti);
                if(!d)return i.reply({content:'❓ Invalid time format. Use format like: 1d (1 day), 2h (2 hours), 30m (30 minutes), 45s (45 seconds)',ephemeral:true});
                if(d>28*24*60*60*1000)return i.reply({content:'⚠️ Timeout duration cannot exceed 28 days.',ephemeral:true});
                const r=i.options.getString('reason')||`Muted by ${i.user.tag}`;
                try {
                    await t.timeout(d, r);
                    const c=await h.logAction(i.guild,'Mute',i.user,t,r,d);
                    await i.reply({content:`${t} has been muted for ${h.formatTime(d)}`,embeds:[new EB().setColor(CFG.COLORS.INFO).setTitle(`🔇 User Muted - Case #${c}`).setDescription(`${t} has been temporarily silenced`).addFields({name:'⏱️ Duration',value:h.formatTime(d)},{name:'📝 Reason',value:r},{name:'🔨 Moderator',value:i.user.tag}).setTimestamp().setFooter({text:'🎮 MCBETIERS Moderation'})]});
                } catch(e) {
                    console.error('Error in mute command:', e);
                    await i.reply({content:'❌ Failed to mute user. They may have higher permissions than me or I lack necessary permissions.',ephemeral:true});
                }
                break;
            }
            case 'kick': {
                const t = i.options.getMember('user');
                if (!t) return i.reply({content: '❌ Could not find that user.', ephemeral: true});
                if (!t.kickable) return i.reply({
                    content: '⛔ I cannot kick this user. They may have higher permissions than me.',
                    ephemeral: true
                });
                const r = i.options.getString('reason') || `Kicked by ${i.user.tag}`;
                const targetUser = t.user;
                const targetMember = t;
                if (!h.isProtectedUser) {
                    h.isProtectedUser = (userId) => {
                        return userId === i.guild.ownerId ||
                            userId === client.user.id ||
                            (targetMember && (
                                targetMember.roles.cache.has(CFG.SUPPORT_TEAM_ROLE_ID) ||
                                targetMember.roles.cache.has(CFG.MODERATOR_ROLE_ID)
                            ));
                    };
                }
                await i.deferReply();
                if (h.isProtectedUser(targetUser.id)) {
                    await i.editReply({ content: 'This user is protected and cannot be kicked.' });

                    const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        const attemptEmbed = new EB()
                            .setColor(CFG.COLORS.WARNING)
                            .setTitle('⚠️ Protected User Kick Attempt')
                            .setDescription(`An attempt was made to kick a protected user`)
                            .addFields(
                                {name: '👤 Protected User', value: `${targetUser.tag} (${targetUser.id})`, inline: true},
                                {name: '🔨 Attempted By', value: `${i.user.tag} (${i.user.id})`, inline: true},
                                {name: '📝 Reason Provided', value: r}
                            )
                            .setTimestamp()
                            .setFooter({text: '🎮 MCBETIERS Moderation'});
                        await logChannel.send({embeds: [attemptEmbed]});
                    }
                    return;
                }
                try {
                    const c = await h.logAction(i.guild, 'Kick', i.user, t, r);

                    await t.kick(r);

                    await i.editReply({
                        content: `${t.user.tag} has been kicked from the server`,
                        embeds: [
                            new EB()
                                .setColor(CFG.COLORS.WARNING)
                                .setTitle(`👢 User Kicked - Case #${c}`)
                                .setDescription(`${t.user.tag} has been removed from the server`)
                                .addFields(
                                    {name: '📝 Reason', value: r},
                                    {name: '🔨 Moderator', value: i.user.tag}
                                )
                                .setTimestamp()
                                .setFooter({text: '🎮 MCBETIERS Moderation'})
                        ]
                    });
                } catch(e) {
                    console.error('Error in kick command:', e);
                    await i.editReply({content: '❌ Failed to kick user. An unexpected error occurred.'});
                }
                break;
            }
            case 'enroll': {
                const teamName = i.options.getString('name');
                if (!teamName) return i.reply({ content: '❌ Please provide a team name.', ephemeral: true });
                let tourneyData;
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const tourneyPath = './tourney.json';
                    if (!fs.existsSync(tourneyPath)) {
                        tourneyData = { teams: [] };
                        const dir = path.dirname(tourneyPath);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }
                    } else {
                        const fileData = fs.readFileSync(tourneyPath, 'utf8');
                        try {
                            tourneyData = JSON.parse(fileData);
                            if (!tourneyData.teams) tourneyData.teams = [];
                        } catch (parseError) {
                            console.error('Error parsing tourney.json:', parseError);
                            tourneyData = { teams: [] };
                        }
                    }
                    if (tourneyData.teams.some(team => team.name && team.name.toLowerCase() === teamName.toLowerCase())) {
                        return i.reply({ content: `❌ Team "${teamName}" is already enrolled in the tournament.`, ephemeral: true });
                    }
                    tourneyData.teams.push({
                        name: teamName,
                        enrolledBy: i.user.tag,
                        enrolledAt: new Date().toISOString()
                    });
                    fs.writeFileSync(tourneyPath, JSON.stringify(tourneyData, null, 2));
                    await i.reply({
                        content: `✅ Team "${teamName}" has been enrolled in the tournament!`,
                        embeds: [
                            new EB()
                                .setColor(CFG.COLORS.SUCCESS)
                                .setTitle('🏆 Tournament Enrollment')
                                .setDescription(`Team "${teamName}" has been successfully enrolled`)
                                .addFields(
                                    { name: '📋 Team Name', value: teamName },
                                    { name: '👤 Enrolled By', value: i.user.tag }
                                )
                                .setTimestamp()
                                .setFooter({ text: '🎮 Tournament Management' })
                        ]
                    });
                } catch (e) {
                    console.error('Error in enroll command:', e);
                    await i.reply({ content: `❌ Failed to enroll team: ${e.message}`, ephemeral: true });
                }
                break;
            }
            case 'unenroll': {
                const teamName = i.options.getString('name');
                if (!teamName) return i.reply({ content: '❌ Please provide a team name.', ephemeral: true });
                try {
                    const fs = require('fs');
                    const tourneyPath = './tourney.json';
                    if (!fs.existsSync(tourneyPath)) {
                        return i.reply({ content: '❌ No tournament data found. No teams are currently enrolled.', ephemeral: true });
                    }
                    const fileData = fs.readFileSync(tourneyPath, 'utf8');
                    let tourneyData;
                    try {
                        tourneyData = JSON.parse(fileData);
                        if (!tourneyData.teams) tourneyData.teams = [];
                    } catch (parseError) {
                        console.error('Error parsing tourney.json:', parseError);
                        return i.reply({ content: '❌ Tournament data is corrupted. Please contact an administrator.', ephemeral: true });
                    }
                    const teamIndex = tourneyData.teams.findIndex(team => team.name && team.name.toLowerCase() === teamName.toLowerCase());
                    if (teamIndex === -1) {
                        return i.reply({ content: `❌ Team "${teamName}" is not enrolled in the tournament.`, ephemeral: true });
                    }
                    const removedTeam = tourneyData.teams.splice(teamIndex, 1)[0];
                    fs.writeFileSync(tourneyPath, JSON.stringify(tourneyData, null, 2));
                    await i.reply({
                        content: `✅ Team "${teamName}" has been unenrolled from the tournament.`,
                        embeds: [
                            new EB()
                                .setColor(CFG.COLORS.WARNING)
                                .setTitle('🚫 Tournament Unenrollment')
                                .setDescription(`Team "${teamName}" has been removed from the tournament`)
                                .addFields(
                                    { name: '📋 Team Name', value: teamName },
                                    { name: '👤 Unenrolled By', value: i.user.tag }
                                )
                                .setTimestamp()
                                .setFooter({ text: '🎮 Tournament Management' })
                        ]
                    });
                } catch (e) {
                    console.error('Error in unenroll command:', e);
                    await i.reply({ content: `❌ Failed to unenroll team: ${e.message}`, ephemeral: true });
                }
                break;
            }
            case 'tournament': {
                try {
                    const fs = require('fs');
                    const tourneyPath = './tourney.json';
                    if (!fs.existsSync(tourneyPath)) {
                        return i.reply({ content: '📋 No teams are currently enrolled in the tournament.', ephemeral: false });
                    }
                    const fileData = fs.readFileSync(tourneyPath, 'utf8');
                    let tourneyData;
                    try {
                        tourneyData = JSON.parse(fileData);
                        if (!tourneyData.teams) tourneyData.teams = [];
                    } catch (parseError) {
                        console.error('Error parsing tourney.json:', parseError);
                        return i.reply({ content: '❌ Tournament data is corrupted. Please contact an administrator.', ephemeral: true });
                    }
                    if (tourneyData.teams.length === 0) {
                        return i.reply({ content: '📋 No teams are currently enrolled in the tournament.', ephemeral: false });
                    }
                    const teamList = tourneyData.teams.map((team, index) =>
                        `${index + 1}. **${team.name}**`
                    ).join('\n');
                    await i.reply({
                        embeds: [
                            new EB()
                                .setColor(CFG.COLORS.INFO)
                                .setTitle('🏆 Tournament Teams')
                                .setDescription('Here are all the teams currently enrolled:')
                                .addFields(
                                    { name: '📋 Enrolled Teams', value: teamList },
                                    { name: '📊 Total Teams', value: `${tourneyData.teams.length} teams enrolled` }
                                )
                                .setTimestamp()
                                .setFooter({ text: '🎮 Tournament Management' })
                        ]
                    });
                } catch (e) {
                    console.error('Error in tournament command:', e);
                    await i.reply({ content: `❌ Failed to retrieve tournament data: ${e.message}`, ephemeral: true });
                }
                break;
            }
            case 'eloleaderboard': {
                console.log('ELO Leaderboard command started');
                if (!i.deferred && !i.replied) {
                    await i.deferReply();
                }
                let eloData = {};
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const possiblePaths = [
                        './elo.json',
                        path.join(__dirname, 'elo.json'),
                        path.join(process.cwd(), 'elo.json')
                    ];
                    let eloFilePath = null;
                    for (const filePath of possiblePaths) {
                        if (fs.existsSync(filePath)) {
                            eloFilePath = filePath;
                            console.log(`Found ELO file at: ${filePath}`);
                            break;
                        }
                    }
                    if (!eloFilePath) {
                        console.log('No ELO data file found in any of these locations:', possiblePaths);
                        return i.editReply({ content: '❌ No ELO data found. Make sure elo.json exists.' });
                    }
                    const data = fs.readFileSync(eloFilePath, 'utf8');
                    eloData = JSON.parse(data);
                    console.log(`Loaded ELO data with ${Object.keys(eloData).length} players`);
                } catch (err) {
                    console.error('Error reading ELO data:', err);
                    return i.editReply({ content: '❌ Error reading ELO data: ' + err.message });
                }
                const validPlayers = [];
                for (const [playerId, playerData] of Object.entries(eloData)) {
                    if (playerData && typeof playerData.elo === 'number' && playerData.username) {
                        validPlayers.push(playerData);
                    } else {
                        console.log(`Invalid player data for ${playerId}:`, playerData);
                    }
                }
                const sortedPlayers = validPlayers
                    .sort((a, b) => b.elo - a.elo)
                    .slice(0, 10);
                if (sortedPlayers.length === 0) {
                    console.log('No valid players found in ELO data');
                    return i.editReply({ content: '❌ No players with valid ELO rankings found.' });
                }
                console.log(`Found ${sortedPlayers.length} valid players for leaderboard`);
                try {
                    const { generateEloLeaderboardImage } = require('./utils/imageGenerator.js');
                    console.log('Generating leaderboard image...');
                    const imageBuffer = await generateEloLeaderboardImage(eloData);
                    console.log('Image generated successfully, creating attachment...');
                    const { AttachmentBuilder } = require('discord.js');
                    const attachment = new AttachmentBuilder(imageBuffer, { name: 'elo-leaderboard.png' });
                    const topPlayer = sortedPlayers[0];
                    const totalPlayers = Object.keys(eloData).length;
                    console.log('Sending reply with image...');
                    await i.editReply({
                        content: `🏆 **ELO Leaderboard**\n\n` +
                            `**👑 Top Player:** ${topPlayer.username} (${topPlayer.elo} ELO)\n` +
                            `**📊 Total Players:** ${totalPlayers}\n` +
                            `**🎮 Play ranked fights to earn ELO!**`,
                        files: [attachment]
                    });
                    console.log('ELO leaderboard image sent successfully');
                } catch (imageErr) {
                    console.error('Error generating leaderboard image:', imageErr);
                    console.log('Falling back to embed version...');
                    let EB;
                    try {
                        EB = require('discord.js').EmbedBuilder;
                    } catch (embedErr) {
                        console.error('Could not import EmbedBuilder:', embedErr);
                        try {
                            const { EmbedBuilder } = require('discord.js');
                            EB = EmbedBuilder;
                        } catch (embedErr2) {
                            console.error('EmbedBuilder import failed completely:', embedErr2);
                            let leaderboardText = '🏆 **ELO Leaderboard**\n\n';
                            sortedPlayers.forEach((player, index) => {
                                const medal = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                                leaderboardText += `${medal} **${player.username}** - ${player.elo} ELO\n`;
                            });
                            return i.editReply({ content: leaderboardText });
                        }
                    }
                    const medals = ['👑', '🥈', '🥉'];
                    const rankIcons = ['4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                    const embed = new EB()
                        .setColor('#00ff00')
                        .setTitle('🏆 ELO Leaderboard')
                        .setTimestamp();
                    if (typeof CFG !== 'undefined' && CFG.COLORS && CFG.COLORS.INFO) {
                        embed.setColor(CFG.COLORS.INFO);
                    }
                    let leaderboardText = '';
                    leaderboardText += '```\n# Rank | Player           | ELO Rating\n' +
                        '-----------------------------------\n';
                    sortedPlayers.forEach((player, index) => {
                        const rankDisplay = index < 3 ? medals[index] : rankIcons[index - 3] || `${index + 1}.`;
                        const username = player.username.length > 15 ?
                            player.username.substring(0, 12) + '...' :
                            player.username.padEnd(15, ' ');
                        leaderboardText += `${String(index + 1).padStart(2)} | ${username} | ${player.elo}\n`;
                    });
                    leaderboardText += '```';
                    const topPlayer = sortedPlayers[0];
                    const totalPlayers = Object.keys(eloData).length;
                    embed.setDescription(
                        `${leaderboardText}\n` +
                        `\n**Top Player:** ${topPlayer.username} (${topPlayer.elo} ELO)` +
                        `\n**Total Players:** ${totalPlayers}` +
                        `\n\nPlay ranked fights to earn ELO!`
                    );
                    const fs = require('fs');
                    const logoPath = './logo.png';
                    const files = [];
                    if (fs.existsSync(logoPath)) {
                        files.push({ attachment: logoPath, name: 'logo.png' });
                        embed.setThumbnail('attachment://logo.png');
                        embed.setFooter({ text: '🎮 MCBETIERS', iconURL: 'attachment://logo.png' });
                    } else {
                        embed.setFooter({ text: '🎮 MCBETIERS' });
                        console.log('Logo file not found at ./logo.png');
                    }
                    await i.editReply({ embeds: [embed], files: files });
                    console.log('Fallback embed sent successfully');
                }
                break;
            }
            case'warn':{
                const t=i.options.getMember('user');
                if(!t)return i.reply({content:'❌ Could not find that user.',ephemeral:true});
                const r=i.options.getString('reason');
                if(!r)return i.reply({content:'❗ A reason is required for warnings.',ephemeral:true});
                const c=await h.logAction(i.guild,'Warn',i.user,t,r);
                const e=new EB().setColor(CFG.COLORS.PRIMARY).setTitle(`⚠️ You've Been Warned - Case #${c}`).setDescription(`You have received a warning in ${i.guild.name}`).addFields({name:'📝 Reason',value:r},{name:'🔨 Moderator',value:i.user.tag}).setTimestamp().setFooter({text:'🎮 MCBETIERS Moderation'});
                try{await t.send({embeds:[e]});}catch(e){}
                const re=new EB().setColor(CFG.COLORS.PRIMARY).setTitle(`⚠️ Warning Issued - Case #${c}`).setDescription(`${t} has been warned`).addFields({name:'📝 Reason',value:r},{name:'🔨 Moderator',value:i.user.tag}).setTimestamp().setFooter({text:'🎮 MCBETIERS Moderation'});
                await i.reply({content:`Warning issued to ${t}`,embeds:[re]});
                break;
            }
            case 'snipe': {
                const channel = i.options.getChannel('channel') || i.channel;
                if (!deletedMessages.has(channel.id)) {
                    return i.reply({content: `📭 No recently deleted messages found in <#${channel.id}>.`, ephemeral: true});
                }
                const msg = deletedMessages.get(channel.id);
                const timeAgo = Math.floor((Date.now() - msg.deletedAt) / 1000);
                const embed = new EB()
                    .setColor(CFG.COLORS.PRIMARY)
                    .setTitle('🕵️ sniped')
                    .setDescription(msg.content)
                    .addFields(
                        {name: '👤 Author', value: `<@${msg.authorId}> (${msg.authorTag})`, inline: true},
                        {name: '📱 Channel', value: `<#${msg.channelId}>`, inline: true},
                        {name: '⌚ Deleted', value: `${timeAgo} seconds ago`, inline: true}
                    )
                    .setTimestamp()
                    .setFooter({text: '🎮 MCBETIERS Moderation'});
                if (msg.attachments.length > 0) {
                    embed.addFields({
                        name: '📎 Attachments',
                        value: msg.attachments.map(a => `[${a.name}](${a.url})`).join('\n')
                    });
                }
                await i.reply({embeds: [embed]});
                break;
            }
            case 'info': {
                await i.deferReply();
                try {
                    const targetUser = i.options.getUser('user');
                    if (!targetUser) return i.editReply({content: '❌ Could not find that user.'});
                    const targetMember = await i.guild.members.fetch(targetUser.id).catch(() => null);
                    if (!targetMember) return i.editReply({content: '❌ This user is not a member of this server.'});
                    const accountCreated = Math.floor(targetUser.createdTimestamp / 1000);
                    const accountAge = h.formatUptime(Date.now() - targetUser.createdTimestamp);
                    const joinedAt = Math.floor(targetMember.joinedTimestamp / 1000);
                    const joinAge = h.formatUptime(Date.now() - targetMember.joinedTimestamp);
                    let joinMethod = 'Unknown';
                    try {
                        const guildInvites = await i.guild.invites.fetch();
                        const userInvite = guildInvites.find(invite =>
                            invite.inviter && invite.uses > 0 &&
                            invite.maxUses > 0 && invite.expiresAt > Date.now());

                        if (userInvite) {
                            joinMethod = `Invited by ${userInvite.inviter.tag}`;
                        } else {
                            joinMethod = 'Data Unavaliable, Contact @whoseqou2';
                        }
                    } catch (err) {
                        console.error('Error fetching invite info:', err);
                        joinMethod = 'Unable to determine (missing permissions)';
                    }
                    const roles = targetMember.roles.cache
                        .filter(role => role.id !== i.guild.id)
                        .sort((a, b) => b.position - a.position)
                        .map(role => `<@&${role.id}>`)
                        .slice(0, 10);

                    const roleDisplay = roles.length ? roles.join(', ') : 'No roles';
                    const boostingSince = targetMember.premiumSince
                        ? `<t:${Math.floor(new Date(targetMember.premiumSince).getTime() / 1000)}:R>`
                        : 'Not boosting';
                    const infoEmbed = new EB()
                        .setColor(targetMember.displayHexColor || CFG.COLORS.PRIMARY)
                        .setTitle(`ℹ️ User Information: ${targetUser.tag}`)
                        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            { name: '👤 User', value: `${targetUser} (${targetUser.tag})`, inline: true },
                            { name: '🆔 ID', value: targetUser.id, inline: true },
                            { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                            { name: '📅 Account Created', value: `<t:${accountCreated}:F> (<t:${accountCreated}:R>)`, inline: true },
                            { name: '⏱️ Account Age', value: accountAge, inline: true },
                            { name: '📥 Joined Server', value: `<t:${joinedAt}:F> (<t:${joinedAt}:R>)`, inline: true },
                            { name: '⌛ Time in Server', value: joinAge, inline: true },
                            { name: '🔰 Join Method', value: joinMethod, inline: true },
                            { name: '🚀 Boosting Since', value: boostingSince, inline: true },
                            { name: `🏷️ Roles [${roles.length}]`, value: roleDisplay }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS System' });
                    if (targetMember.presence) {
                        const status = {
                            online: '🟢 Online',
                            idle: '🟡 Idle',
                            dnd: '🔴 Do Not Disturb',
                            offline: '⚫ Offline'
                        };
                        const statusText = status[targetMember.presence.status] || '⚫ Unknown';
                        infoEmbed.addFields({ name: '📶 Status', value: statusText, inline: true });

                        if (targetMember.presence.activities && targetMember.presence.activities.length > 0) {
                            const activity = targetMember.presence.activities[0];
                            let activityText = `${activity.type === 0 ? '🎮 Playing' : '📱 Activity'}: ${activity.name}`;

                            if (activity.details) activityText += `\n${activity.details}`;
                            if (activity.state) activityText += `\n${activity.state}`;

                            infoEmbed.addFields({ name: '🎯 Activity', value: activityText });
                        }
                    }
                    if (targetMember.permissions) {
                        const keyPermissions = [];
                        if (targetMember.permissions.has(PFB.Administrator)) keyPermissions.push('Administrator');
                        if (targetMember.permissions.has(PFB.ManageGuild)) keyPermissions.push('Manage Server');
                        if (targetMember.permissions.has(PFB.ManageRoles)) keyPermissions.push('Manage Roles');
                        if (targetMember.permissions.has(PFB.ManageChannels)) keyPermissions.push('Manage Channels');
                        if (targetMember.permissions.has(PFB.ManageWebhooks)) keyPermissions.push('Manage Webhooks');
                        if (targetMember.permissions.has(PFB.ManageGuildExpressions)) keyPermissions.push('Manage Server Expressions');
                        if (targetMember.permissions.has(PFB.ManageEvents)) keyPermissions.push('Manage Events');
                        if (targetMember.permissions.has(PFB.BanMembers)) keyPermissions.push('Ban Members');
                        if (targetMember.permissions.has(PFB.KickMembers)) keyPermissions.push('Kick Members');
                        if (targetMember.permissions.has(PFB.ModerateMembers)) keyPermissions.push('Moderate Members');
                        if (targetMember.permissions.has(PFB.ManageMessages)) keyPermissions.push('Manage Messages');
                        if (targetMember.permissions.has(PFB.ManageNicknames)) keyPermissions.push('Manage Nicknames');
                        if (targetMember.permissions.has(PFB.MoveMembers)) keyPermissions.push('Move Members');
                        if (targetMember.permissions.has(PFB.DeafenMembers)) keyPermissions.push('Deafen Members');
                        if (targetMember.permissions.has(PFB.MuteMembers)) keyPermissions.push('Mute Members');
                        if (targetMember.permissions.has(PFB.MentionEveryone)) keyPermissions.push('Mention @everyone');
                        if (targetMember.permissions.has(PFB.SendTTSMessages)) keyPermissions.push('Send TTS Messages');
                        if (targetMember.permissions.has(PFB.UseExternalEmojis)) keyPermissions.push('Use External Emojis');
                        if (targetMember.permissions.has(PFB.UseExternalStickers)) keyPermissions.push('Use External Stickers');
                        if (targetMember.permissions.has(PFB.AddReactions)) keyPermissions.push('Add Reactions');
                        if (targetMember.permissions.has(PFB.PrioritySpeaker)) keyPermissions.push('Priority Speaker');
                        if (targetMember.permissions.has(PFB.ViewAuditLog)) keyPermissions.push('View Audit Log');
                        if (targetMember.permissions.has(PFB.AttachFiles)) keyPermissions.push('Attach Files');
                        if (targetMember.permissions.has(PFB.EmbedLinks)) keyPermissions.push('Embed Links');
                        if (keyPermissions.length > 0) {
                            const displayPermissions = keyPermissions.slice(0, 15);
                            const permissionText = displayPermissions.join(', ') +
                                (keyPermissions.length > 15 ? ` +${keyPermissions.length - 15} more` : '');
                            infoEmbed.addFields({
                                name: `🛡️ Key Permissions [${keyPermissions.length}]`,
                                value: permissionText
                            });
                        }
                    }
                    await i.editReply({ embeds: [infoEmbed] });
                } catch (err) {
                    console.error('Error in info command:', err);
                    await i.editReply({ content: '❌ An error occurred while fetching user information.' });
                }
                break;
            }
            case'modlogs':{
                const t=i.options.getMember('user')||i.options.getUser('user');
                if(!t)return i.reply({content:'❌ Could not find that user.',ephemeral:true});
                const u=t.id;
                if(!modLogs.has(u)||modLogs.get(u).length===0)return i.reply({content:`📂 ${t} has no moderation history.`,ephemeral:true});
                const l=modLogs.get(u);
                const e=new EB().setColor(CFG.COLORS.PRIMARY).setTitle(`📜 Moderation History: ${t.tag||t.user.tag}`).setDescription(`This user has ${l.length} moderation ${l.length===1?'record':'records'}.`).setTimestamp().setFooter({text:'🎮 MCBETIERS Moderation'});
                const em={Ban:'🔨',Kick:'👢',Mute:'🔇',Warn:'⚠️'};
                l.slice(-25).forEach(log=>{const em2=em[log.type]||'🛡️';e.addFields({name:`${em2} ${log.type} - Case #${log.caseId}`,value:`**Moderator:** ${log.moderatorTag}\n**Reason:** ${log.reason}\n**Date:** <t:${Math.floor(log.timestamp/1000)}:f>${log.duration?`\n**Duration:** ${log.duration}`:''}`});});
                await i.reply({embeds:[e],ephemeral:false});
                break;
            }
            case 'giveaway': {
                const prize = i.options.getString('prize');
                const duration = i.options.getString('duration');
                const winners = i.options.getInteger('winners') || 1;
                const description = i.options.getString('description');
                const parsedDuration = h.parseTime(duration);
                if (!parsedDuration) {
                    return i.reply({content: '❓ Invalid time format. Use format like: 1d (1 day), 2h (2 hours), 30m (30 minutes)', ephemeral: true});
                }
                if (parsedDuration < 10000) {
                    return i.reply({content: '⚠️ Giveaway duration must be at least 10 seconds.', ephemeral: true});
                }

                if (winners < 1 || winners > 20) {
                    return i.reply({content: '⚠️ Number of winners must be between 1 and 20.', ephemeral: true});
                }
                const endTime = Date.now() + parsedDuration;
                const endTimestamp = Math.floor(endTime / 1000);
                const embed = new EB()
                    .setColor('#FF6B6B')
                    .setTitle('🎉 GIVEAWAY 🎉')
                    .setDescription(`**Prize:** ${prize}\n${description ? `**Details:** ${description}\n` : ''}**Winners:** ${winners}\n**Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:F>)\n\n🎁 Click the button below to enter!`)
                    .setFooter({text: `Hosted by ${i.user.tag} • ${winners} winner${winners > 1 ? 's' : ''}`, iconURL: i.user.displayAvatarURL()})
                    .setTimestamp(endTime);
                const button = new ButtonBuilder()
                    .setCustomId('giveaway_enter')
                    .setLabel('🎉 Enter Giveaway')
                    .setStyle(ButtonStyle.Primary);
                const row = new ActionRowBuilder().addComponents(button);
                const msg = await i.reply({
                    embeds: [embed],
                    components: [row],
                    fetchReply: true
                });
                activeGiveaways.set(msg.id, {
                    channelId: i.channelId,
                    guildId: i.guildId,
                    hostId: i.user.id,
                    prize,
                    winners,
                    endTime,
                    entries: new Set(),
                    ended: false
                });
                setTimeout(() => {
                    endGiveaway(msg.id);
                }, parsedDuration);

                break;
            }
            case 'reroll': {
                const messageId = i.options.getString('message_id');
                if (!activeGiveaways.has(messageId)) {
                    return i.reply({content: '❌ Could not find that giveaway or it may have already been deleted.', ephemeral: true});
                }
                const giveaway = activeGiveaways.get(messageId);
                if (!giveaway.ended) {
                    return i.reply({content: '❌ That giveaway has not ended yet. Use `/end` to end it early.', ephemeral: true});
                }
                await rerollGiveaway(messageId, i);
                break;
            }
            case 'end': {
                const messageId = i.options.getString('message_id');

                if (!activeGiveaways.has(messageId)) {
                    return i.reply({content: '❌ Could not find that giveaway.', ephemeral: true});
                }

                const giveaway = activeGiveaways.get(messageId);
                if (giveaway.ended) {
                    return i.reply({content: '❌ That giveaway has already ended.', ephemeral: true});
                }

                await endGiveaway(messageId);
                await i.reply({content: '✅ Giveaway ended early!', ephemeral: true});
                break;
            };
            case 'ban': {
                try {
                    const targetUser = i.options.getUser('user');
                    const targetMember = await i.guild.members.fetch(targetUser.id).catch(() => null);
                    const deleteDays = i.options.getInteger('delete_messages') || 0;
                    const reason = i.options.getString('reason') || `No reason provided by ${i.user.tag}`;

                    if (!h.isProtectedUser) {
                        h.isProtectedUser = (userId) => {
                            return userId === i.guild.ownerId ||
                                userId === client.user.id ||
                                (targetMember && (
                                    targetMember.roles.cache.has(CFG.SUPPORT_TEAM_ROLE_ID) ||
                                    targetMember.roles.cache.has(CFG.MODERATOR_ROLE_ID)
                                ));
                        };
                    }
                    await i.deferReply();
                    if (h.isProtectedUser(targetUser.id)) {
                        await i.editReply({ content: 'This user is protected and cannot be banned.' });
                        const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                        if (logChannel) {
                            const attemptEmbed = new EB()
                                .setColor(CFG.COLORS.WARNING)
                                .setTitle('⚠️ Protected User Ban Attempt')
                                .setDescription(`An attempt was made to ban a protected user`)
                                .addFields(
                                    {name: '👤 Protected User', value: `${targetUser.tag} (${targetUser.id})`, inline: true},
                                    {name: '🔨 Attempted By', value: `${i.user.tag} (${i.user.id})`, inline: true},
                                    {name: '📝 Reason Provided', value: reason}
                                )
                                .setTimestamp()
                                .setFooter({text: '🎮 MCBETIERS Moderation'});
                            await logChannel.send({embeds: [attemptEmbed]});
                        }
                        return;
                    }

                    if (!i.member.permissions.has(PFB.BanMembers)) {
                        return await i.editReply({content: '🚫 You do not have permission to ban members.'});
                    }
                    if (targetMember) {
                        if (targetMember.roles.highest.position >= i.member.roles.highest.position && i.member.id !== i.guild.ownerId) {
                            return await i.editReply({content: '⚠️ You cannot ban a member with a higher or equal role.'});
                        }
                        if (!targetMember.bannable) {
                            return await i.editReply({content: '❌ I do not have permission to ban this user. They may have a higher role than me.'});
                        }
                    }

                    const banEmbed = new EB()
                        .setColor(CFG.COLORS.DANGER)
                        .setTitle('🔨 User Banned')
                        .setDescription(`${targetUser.tag} has been banned from the server.`)
                        .addFields(
                            {name: '👤 User', value: `${targetUser.tag} (${targetUser.id})`, inline: true},
                            {name: '🔨 Moderator', value: `${i.user.tag} (${i.user.id})`, inline: true},
                            {name: '📝 Reason', value: reason},
                            {name: '🗑️ Message Deletion', value: `${deleteDays} day(s)`, inline: true}
                        )
                        .setTimestamp()
                        .setFooter({text: '🎮 MCBETIERS Moderation'});

                    try {
                        const dmEmbed = new EB()
                            .setColor(CFG.COLORS.DANGER)
                            .setTitle(`🔨 You Have Been Banned`)
                            .setDescription(`You have been banned from ${i.guild.name}`)
                            .addFields(
                                {name: '📝 Reason', value: reason},
                                {name: '🔨 Banned By', value: `${i.user.tag}`}
                            )
                            .setTimestamp()
                            .setFooter({text: '🎮 MCBETIERS System'});

                        if (targetMember) {
                            await targetMember.send({embeds: [dmEmbed]}).catch(() => {
                            });
                        }
                    } catch (e) {
                        console.log(`Could not send DM to ${targetUser.tag}: ${e.message}`);
                    }

                    const caseId = await h.logAction(i.guild, 'ban', i.user, targetUser, reason);
                    await i.guild.members.ban(targetUser, {
                        deleteMessageSeconds: deleteDays * 24 * 60 * 60,
                        reason: `${reason} (Case #${caseId})`
                    });
                    await i.editReply({
                        content: `✅ Successfully banned ${targetUser.tag}`,
                        embeds: [banEmbed]
                    });
                    const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                    if (logChannel) {
                        await logChannel.send({embeds: [banEmbed]});
                    }
                } catch (e) {
                    console.error('Error in ban command:', e);
                    if (i.deferred) {
                        await i.editReply({content: `❌ An error occurred while banning the user: ${e.message}`});
                    } else {
                        await i.reply({content: `❌ An error occurred while banning the user: ${e.message}`, ephemeral: true});
                    }
                }
                break;
            }
            case 'reboot': {
                const SUPERUSER_ID = '510847369454026753';

                if(i.user.id !== SUPERUSER_ID && i.user.id !== i.guild.ownerId && !i.member.permissions.has(PFB.Administrator)) {
                    await i.reply({content:'🚫 This command can only be used by server administrators.',ephemeral:true});
                    return;
                }

                const reason = i.options.getString('reason') || `Manual restart by ${i.user.tag}`;

                await i.reply({
                    embeds:[
                        new EB()
                            .setColor(CFG.COLORS.WARNING)
                            .setTitle('🔄 Bot Rebooting')
                            .setDescription('The bot is now rebooting. This may take a few moments.')
                            .addFields(
                                {name:'👤 Requested By', value:i.user.tag, inline:true},
                                {name:'📝 Reason', value:reason, inline:true},
                                {name:'⏱️ Uptime Before Reboot', value:h.formatUptime(Date.now()-BOT_START_TIME), inline:true}
                            )
                            .setTimestamp()
                            .setFooter({text:'🎮 MCBETIERS System'})
                    ]
                });
                const logChannel = await i.guild.channels.fetch(CFG.LOG_CHANNEL_ID).catch(() => null);
                if(logChannel) {
                    await logChannel.send({
                        embeds:[
                            new EB()
                                .setColor(CFG.COLORS.WARNING)
                                .setTitle('🔄 System Alert: Bot Rebooting')
                                .setDescription(`The bot has been manually rebooted by ${i.user.tag}`, )
                                .addFields(
                                    {name:'📝 Reason', value:reason, inline:true},
                                    {name:'⏱️ Uptime', value:h.formatUptime(Date.now()-BOT_START_TIME), inline:true},
                                    {name:'🕒 Time', value:`<t:${Math.floor(Date.now()/1000)}:F>`, inline:true}
                                )
                                .setTimestamp()
                                .setFooter({text:'🎮 MCBETIERS System'})
                        ]
                    });
                }
                h.saveLogs();
                setTimeout(() => {
                    console.log(`Bot restarted by ${i.user.tag}: ${reason}`);
                    process.exit(0);
                }, 1500);
                break;
            }
        }
    } catch(e) {
        console.error(`Error executing ${cmd} command:`,e);
        const err=`⚠️ An error occurred while executing the ${cmd} command.`;
        if(i.replied||i.deferred)await i.followUp({content:err,ephemeral:true});
        else await i.reply({content:err,ephemeral:true});
    }
});
client.on('interactionCreate', async (i) => {
    try {
    } catch(e) {
        console.error(`Error executing ${cmd} command:`,e);
        const err=`⚠️ An error occurred while executing the ${cmd} command.`;
        if(i.replied||i.deferred)await i.followUp({content:err,ephemeral:true});
        else await i.reply({content:err,ephemeral:true});
    }
    // interaction handler
    async function safeReply(interaction, options) {
        try {
            if (interaction.replied || interaction.deferred) {
                return await interaction.followUp(options);
            } else {
                return await interaction.reply(options);
            }
        } catch (error) {
            console.error('Error in safeReply:', error);
            try {
                if (interaction.replied) {
                    return await interaction.editReply(options);
                }
            } catch (editError) {
                console.error('Could not edit reply either:', editError);
            }
        }
    }
    if (i.isButton() && i.customId.startsWith('ticket_')) {
        try {
            const db = readDB();
            const config = db.ticketConfigs[i.customId];

            if (!config) {
                return await safeReply(i, {
                    content: '❌ Ticket configuration not found.',
                    ephemeral: true
                });
            }
            const { categoryId, name, prompts } = config;
            const userId = i.user.id;
            const existingEntry = await checkExistingTicket(userId, categoryId, db);
            if (existingEntry) {
                if (existingEntry.type === 'active') {
                    return await safeReply(i, {
                        content: `❌ You already have an active ticket: <#${existingEntry.channelId}>`,
                        ephemeral: true
                    });
                } else if (existingEntry.type === 'queued') {
                    const embed = new EB()
                        .setColor(CFG.COLORS.WARNING)
                        .setTitle('🎫 Already in Queue')
                        .setDescription(`You are already in the queue for **${name}**`)
                        .addFields(
                            { name: '📍 Position', value: `#${existingEntry.position}`, inline: true },
                            { name: '🌍 Region', value: existingEntry.region, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS Ticket System' });

                    return await safeReply(i, {
                        embeds: [embed],
                        ephemeral: true
                    });
                }
            }
            if (prompts && prompts.length > 0) {
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_modal_${categoryId}_${i.customId}`)
                    .setTitle(`${name} - Ticket Information`);

                for (let j = 0; j < Math.min(prompts.length, 5); j++) {
                    const input = new TextInputBuilder()
                        .setCustomId(`input_${j}`)
                        .setLabel(prompts[j])
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                }

                await i.showModal(modal);
            } else {
                await handleTicketCreation(i, categoryId, name, [], db);
            }
        } catch (error) {
            console.error('Error in button interaction:', error);
            await safeReply(i, {
                content: '❌ An error occurred while processing your request.',
                ephemeral: true
            });
        }
    }
    if (i.isModalSubmit() && i.customId.startsWith('ticket_modal_')) {
        try {
            const parts = i.customId.split('_');
            const categoryId = parts[2]; 
            const originalButtonId = `ticket_${categoryId}`;
            const db = readDB();
            const config = db.ticketConfigs[originalButtonId];
            console.log('Modal submission - categoryId:', categoryId);
            console.log('Looking for config:', originalButtonId);
            console.log('Available configs:', Object.keys(db.ticketConfigs));
            if (!config) {
                return await safeReply(i, {
                    content: '❌ Ticket configuration not found.',
                    ephemeral: true
                });
            }
            const responses = [];
            for (let j = 0; j < config.prompts.length; j++) {
                try {
                    const response = i.fields.getTextInputValue(`input_${j}`);
                    responses.push({
                        prompt: config.prompts[j],
                        response: response
                    });
                } catch (fieldError) {
                    console.error(`Error getting field input_${j}:`, fieldError);
                }
            }
            console.log('Modal responses:', responses);
            await handleTicketCreation(i, categoryId, config.name, responses, db);
        } catch (error) {
            console.error('Error in modal submission:', error);
            await safeReply(i, {
                content: '❌ An error occurred while processing your ticket request.',
                ephemeral: true
            });
        }
    }
    async function handleTicketCreation(interaction, categoryId, ticketName, responses, db) {
        const userId = interaction.user.id;
        const member = interaction.member;
        if (categoryId === '1362088376198627518') {
            let region = null;
            for (let response of responses) {
                if (response.prompt.toLowerCase().includes('region')) {
                    const regionValue = response.response.toUpperCase();
                    if (['AS', 'EU', 'NA'].includes(regionValue)) {
                        region = regionValue;
                        break;
                    }
                }
            }
            if (!region) {
                return await interaction.reply({
                    content: '❌ Please specify a valid region (AS, EU, or NA).',
                    ephemeral: true
                });
            }
            const activeTicketsInRegion = Object.values(db.activeTickets).filter(
                ticket => ticket.categoryId === categoryId && ticket.region === region
            ).length;
            const hasPriority = member.roles.cache.has('1369041583474872501');
            if (!db.queues[categoryId]) {
                db.queues[categoryId] = { AS: [], EU: [], NA: [] };
            }
            if (!db.queues[categoryId][region]) {
                db.queues[categoryId][region] = [];
            }
            const currentQueue = db.queues[categoryId][region];
            if (activeTicketsInRegion >= 10) {
                const oldPositions = new Map();
                currentQueue.forEach((entry, index) => {
                    oldPositions.set(entry.userId, index + 1);
                });
                const queueEntry = {
                    userId,
                    username: interaction.user.username,
                    responses,
                    timestamp: Date.now(),
                    priority: hasPriority,
                    region
                };
                if (hasPriority) {
                    const priorityCount = currentQueue.filter(entry => entry.priority).length;
                    currentQueue.splice(priorityCount, 0, queueEntry);
                } else {
                    currentQueue.push(queueEntry);
                }
                writeDB(db);
                const newUserPosition = currentQueue.findIndex(entry => entry.userId === userId) + 1;
                if (hasPriority && currentQueue.length > 1) {
                    await notifyPositionChanges(interaction.client, currentQueue, oldPositions, region, userId);
                }
                const embed = new EB()
                    .setColor(hasPriority ? '#ffd700' : '#ffaa00')
                    .setTitle(hasPriority ? '🌟 Added to Priority Queue' : '🎫 Added to Queue')
                    .setDescription(`You have been added to the **${ticketName}** queue.`)
                    .addFields(
                        { name: '📍 Queue Position', value: `#${newUserPosition}`, inline: true },
                        { name: '🌍 Region', value: region, inline: true },
                        { name: '⭐ Priority Status', value: hasPriority ? '✅ **Priority Member**' : '❌ Regular', inline: true },
                        { name: '📊 Queue Stats', value: `Total: ${currentQueue.length} | Priority: ${currentQueue.filter(e => e.priority).length}`, inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: '🎮 MCBETIERS Queue System' });

                if (hasPriority) {
                    embed.addFields({
                        name: '🚀 Priority Benefit',
                        value: 'You have been placed ahead of regular members in the queue!',
                        inline: false
                    });
                }
                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
                try {
                    const dmEmbed = new EB()
                        .setColor(hasPriority ? '#ffd700' : '#ffaa00')
                        .setTitle(hasPriority ? '🌟 Priority Queue Position' : '🎫 Queue Position')
                        .setDescription(`You are **#${newUserPosition}** in the **${ticketName}** queue`)
                        .addFields(
                            { name: '🌍 Region', value: region, inline: true },
                            { name: '⭐ Priority', value: hasPriority ? '✅ Yes' : '❌ No', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS Queue System' });

                    if (hasPriority) {
                        dmEmbed.addFields({
                            name: '🚀 Priority Benefits',
                            value: '• Skip ahead of regular members\n• Faster queue processing\n• Priority notifications',
                            inline: false
                        });
                    }
                    await interaction.user.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log('Could not DM user:', error);
                }
                const logChannel = interaction.client.channels.cache.get('1362109759133585590');
                if (logChannel) {
                    const logEmbed = new EB()
                        .setColor(hasPriority ? '#ffd700' : '#00ffff')
                        .setTitle(hasPriority ? '🌟 Priority User Added to Queue' : '📋 User Added to Queue')
                        .addFields(
                            { name: 'User', value: `<@${userId}>`, inline: true },
                            { name: 'Region', value: region, inline: true },
                            { name: 'Position', value: `#${newUserPosition}`, inline: true },
                            { name: 'Priority', value: hasPriority ? '⭐ Yes' : '❌ No', inline: true }
                        )
                        .setTimestamp();

                    await logChannel.send({ embeds: [logEmbed] });
                }
            } else {
                const embed = new EB()
                    .setColor(hasPriority ? '#ffd700' : '#00ff00')
                    .setTitle(hasPriority ? '🌟 Priority Ticket Created' : '🎫 Ticket Created')
                    .setDescription(`Your ticket is being created...`)
                    .addFields(
                        { name: '🌍 Region', value: region, inline: true },
                        { name: '⭐ Priority Status', value: hasPriority ? '✅ **Priority Member**' : '❌ Regular', inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: '🎮 MCBETIERS Ticket System' });

                if (hasPriority) {
                    embed.addFields({
                        name: '🚀 Priority Benefits',
                        value: 'You receive priority support and queue privileges!',
                        inline: false
                    });
                }
                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
                await createTicket(interaction, categoryId, ticketName, responses, region, db);
            }
        } else {
            await createTicket(interaction, categoryId, ticketName, responses, null, db);
        }
    }
    async function notifyPositionChanges(client, currentQueue, oldPositions, region, newUserId) {
        for (let i = 0; i < currentQueue.length; i++) {
            const entry = currentQueue[i];
            const currentPosition = i + 1;
            const oldPosition = oldPositions.get(entry.userId);
            if (entry.userId === newUserId) continue;
            if (oldPosition && currentPosition > oldPosition) {
                try {
                    const user = await client.users.fetch(entry.userId);
                    const positionChangeEmbed = new EB()
                        .setColor('#ff6b6b') 
                        .setTitle('📉 Queue Position Update')
                        .setDescription('Your queue position has changed due to a priority member joining.')
                        .addFields(
                            { name: '👤 Previous Position', value: `#${oldPosition}`, inline: true },
                            { name: '📍 New Position', value: `#${currentPosition}`, inline: true },
                            { name: '🌍 Region', value: region, inline: true },
                            { name: '📝 Reason', value: 'A priority member joined the queue', inline: false },
                            { name: '💡 Get Priority', value: 'Consider getting priority status to avoid queue bumps!', inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS Queue System' });
                    await user.send({ embeds: [positionChangeEmbed] });
                    console.log(`Notified user ${entry.username} about position change: ${oldPosition} → ${currentPosition}`);
                } catch (error) {
                    console.log(`Could not notify user ${entry.userId} about position change:`, error);
                }
            }
        }
    }
    async function createTicket(interaction, categoryId, ticketName, responses, region, db) {
        const guild = interaction.guild;
        const userId = interaction.user.id;
        const member = interaction.member;
        const hasPriority = member.roles.cache.has('1369041583474872501');
        db.ticketCounter++;
        const ticketNumber = db.ticketCounter;
        const ticketChannelName = region ?
            `ticket-${ticketNumber}-${region.toLowerCase()}` :
            `ticket-${ticketNumber}`;
        try {
            const ticketChannel = await guild.channels.create({
                name: ticketChannelName,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: userId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: '1362075114492920030', // tester role
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });
            const ticketEmbed = new EB()
                .setColor(hasPriority ? '#ffd700' : '#00ff00')
                .setTitle(`${hasPriority ? '🌟' : '🎫'} ${ticketName} - Ticket #${ticketNumber}`)
                .setDescription(`Ticket created for <@${userId}>`)
                .addFields(
                    { name: '👤 User', value: `<@${userId}>`, inline: true },
                    { name: '⭐ Priority Status', value: hasPriority ? '✅ **Priority Member**' : '❌ Regular', inline: true },
                    ...(region ? [{ name: '🌍 Region', value: region, inline: true }] : [])
                )
                .setTimestamp()
                .setFooter({ text: '🎮 MCBETIERS Ticket System' });
            if (responses.length > 0) {
                for (let response of responses) {
                    ticketEmbed.addFields({
                        name: response.prompt,
                        value: response.response,
                        inline: false
                    });
                }
            }
            if (hasPriority) {
                ticketEmbed.addFields({
                    name: '🚀 Priority Benefits Active',
                    value: '• Faster response times\n• Priority queue access\n• Enhanced support',
                    inline: false
                });
            }
            const closeButton = new ButtonBuilder()
                .setCustomId(`close_ticket_${ticketChannel.id}`)
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');
            const row = new ActionRowBuilder().addComponents(closeButton);
            await ticketChannel.send({
                content: `<@${userId}> <@&1362075114492920030>`,
                embeds: [ticketEmbed],
                components: [row]
            });
            db.activeTickets[ticketChannel.id] = {
                userId,
                categoryId: categoryId,
                region,
                ticketNumber,
                priority: hasPriority,
                createdAt: Date.now()
            };
            writeDB(db);
            if (interaction.replied) {
                await interaction.editReply({
                    content: `✅ ${hasPriority ? '🌟 Priority ' : ''}Ticket created: <#${ticketChannel.id}>`,
                    embeds: [],
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `✅ ${hasPriority ? '🌟 Priority ' : ''}Ticket created: <#${ticketChannel.id}>`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error creating ticket:', error);
            const errorMessage = `❌ Failed to create ${hasPriority ? 'priority ' : ''}ticket. Please try again.`;

            if (interaction.replied) {
                await interaction.editReply({
                    content: errorMessage,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true
                });
            }
        }
    }
    if (i.isButton() && i.customId.startsWith('leave_queue_')) {
        try {
            const parts = i.customId.split('_');
            const categoryId = parts[2];
            const region = parts[3];
            const userId = i.user.id;
            const db = readDB();
            if (!db.queues[categoryId] || !db.queues[categoryId][region]) {
                return await safeReply(i, {
                    content: '❌ Queue not found.',
                    ephemeral: true
                });
            }
            const queue = db.queues[categoryId][region];
            const userIndex = queue.findIndex(entry => entry.userId === userId);
            if (userIndex === -1) {
                return await safeReply(i, {
                    content: '❌ You are not in this queue.',
                    ephemeral: true
                });
            }
            const removedUser = queue[userIndex];
            const oldPosition = userIndex + 1;
            queue.splice(userIndex, 1);
            const positionUpdates = [];
            for (let i = userIndex; i < queue.length; i++) {
                const entry = queue[i];
                const newPosition = i + 1;
                const oldPos = i + 2; 
                positionUpdates.push({
                    userId: entry.userId,
                    username: entry.username,
                    oldPosition: oldPos,
                    newPosition: newPosition
                });
            }
            writeDB(db);
            for (const update of positionUpdates) {
                try {
                    const user = await i.client.users.fetch(update.userId);

                    const improvementEmbed = new EB()
                        .setColor('#00ff00')
                        .setTitle('📈 Queue Position Improved!')
                        .setDescription('Your queue position has moved up!')
                        .addFields(
                            { name: '👤 Previous Position', value: `#${update.oldPosition}`, inline: true },
                            { name: '📍 New Position', value: `#${update.newPosition}`, inline: true },
                            { name: '🌍 Region', value: region, inline: true },
                            { name: '📝 Reason', value: 'A user left the queue', inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: '🎮 MCBETIERS Queue System' });
                    await user.send({ embeds: [improvementEmbed] });
                    console.log(`Notified user ${update.username} about position improvement: ${update.oldPosition} → ${update.newPosition}`);
                } catch (error) {
                    console.log(`Could not notify user ${update.userId} about position improvement:`, error);
                }
            }
            const confirmEmbed = new EB()
                .setColor('#ff6b6b') 
                .setTitle('🚪 Left Queue')
                .setDescription('You have successfully left the queue.')
                .addFields(
                    { name: '📍 Previous Position', value: `#${oldPosition}`, inline: true },
                    { name: '🌍 Region', value: region, inline: true },
                    { name: '📊 Queue Length', value: `${queue.length} remaining`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: '🎮 MCBETIERS Ticket System' });
            await safeReply(i, {
                embeds: [confirmEmbed],
                ephemeral: true
            });
            const logChannel = i.client.channels.cache.get('1362109759133585590');
            if (logChannel) {
                const logEmbed = new EB()
                    .setColor('#ff9900')
                    .setTitle('🚪 User Left Queue')
                    .addFields(
                        { name: 'User', value: `<@${userId}>`, inline: true },
                        { name: 'Region', value: region, inline: true },
                        { name: 'Previous Position', value: `#${oldPosition}`, inline: true },
                        { name: 'Priority', value: removedUser.priority ? '⭐ Yes' : '❌ No', inline: true },
                        { name: 'Queue Length', value: `${queue.length} remaining`, inline: true },
                        { name: 'Users Promoted', value: `${positionUpdates.length} users moved up`, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.error('Error in leave queue:', error);
            await safeReply(i, {
                content: '❌ An error occurred while leaving the queue.',
                ephemeral: true
            });
        }
    }
    if (i.isButton() && i.customId.startsWith('close_ticket_')) {
        const ticketChannelId = i.customId.split('_')[2];
        const db = readDB();
        if (!db.activeTickets[ticketChannelId]) {
            return await i.reply({
                content: '❌ Ticket data not found.',
                ephemeral: true
            });
        }
        const ticket = db.activeTickets[ticketChannelId];
        if (!i.member.roles.cache.has('1362075114492920030') && i.user.id !== ticket.userId) {
            return await i.reply({
                content: '❌ You do not have permission to close this ticket.',
                ephemeral: true
            });
        }
        const embed = new EB()
            .setColor(CFG.COLORS.WARNING)
            .setTitle('🔒 Closing Ticket')
            .setDescription('This ticket will be closed in 5 seconds...')
            .setTimestamp();
        await i.reply({ embeds: [embed] });
        if (ticket.categoryId === '1362088376198627518' && ticket.region) {
            if (!db.queues[ticket.categoryId]) {
                db.queues[ticket.categoryId] = { AS: [], EU: [], NA: [] };
            }
            if (!db.queues[ticket.categoryId][ticket.region]) {
                db.queues[ticket.categoryId][ticket.region] = [];
            }
            const queue = db.queues[ticket.categoryId][ticket.region];
            if (queue.length > 0) {
                const nextUser = queue.shift();
                const guild = i.guild;
                const nextMember = await guild.members.fetch(nextUser.userId).catch(() => null);
                if (nextMember) {
                    const mockInteraction = {
                        guild: guild,
                        user: { id: nextUser.userId, username: nextUser.username },
                        member: nextMember,
                        reply: async () => {} 
                    };
                    await createTicket(mockInteraction, ticket.categoryId, 'Tier Testing', nextUser.responses, nextUser.region, db);
                    try {
                        const user = await i.client.users.fetch(nextUser.userId);
                        const dmEmbed = new EB()
                            .setColor(CFG.COLORS.SUCCESS)
                            .setTitle('🎫 Your Ticket is Ready!')
                            .setDescription('Your ticket has been created and is ready for you.')
                            .addFields(
                                { name: '🌍 Region', value: nextUser.region, inline: true }
                            )
                            .setTimestamp();

                        await user.send({ embeds: [dmEmbed] });
                    } catch (error) {
                        console.log('Could not DM user:', error);
                    }
                    const logChannel = i.client.channels.cache.get('1362109759133585590');
                    if (logChannel) {
                        const logEmbed = new EB()
                            .setColor(CFG.COLORS.SUCCESS)
                            .setTitle('📈 Queue Advanced')
                            .addFields(
                                { name: 'User', value: `<@${nextUser.userId}>`, inline: true },
                                { name: 'Region', value: nextUser.region, inline: true },
                                { name: 'Ticket Created', value: '✅ Ready', inline: true }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            }
        }
        delete db.activeTickets[ticketChannelId];
        writeDB(db);
        setTimeout(async () => {
            try {
                const channel = i.guild.channels.cache.get(ticketChannelId);
                if (channel) {
                    await channel.delete();
                }
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
    }
    async function checkExistingTicket(userId, categoryId, db) {
        if (db.activeTickets) {
            for (let [ticketChannelId, ticket] of Object.entries(db.activeTickets)) {
                if (ticket.userId === userId && ticket.categoryId === categoryId) {
                    return {
                        type: 'active',
                        channelId: ticketChannelId
                    };
                }
            }
        }
        if (categoryId === '1362088376198627518') {
            const queues = db.queues && db.queues[categoryId];
            if (queues) {
                for (let [region, queue] of Object.entries(queues)) {
                    if (Array.isArray(queue)) {
                        const position = queue.findIndex(entry => entry.userId === userId);
                        if (position !== -1) {
                            return {
                                type: 'queued',
                                region,
                                position: position + 1
                            };
                        }
                    }
                }
            }
        }

        return null;
    }
    initDB();
    if (i.isButton() && i.customId === 'giveaway_enter') {
        const giveaway = activeGiveaways.get(i.message.id);

        if (!giveaway) {
            return i.reply({content: '❌ This giveaway is no longer active.', ephemeral: true});
        }

        if (giveaway.ended) {
            return i.reply({content: '❌ This giveaway has already ended.', ephemeral: true});
        }

        if (Date.now() >= giveaway.endTime) {
            return i.reply({content: '❌ This giveaway has ended.', ephemeral: true});
        }

        if (giveaway.entries.has(i.user.id)) {
            giveaway.entries.delete(i.user.id);
            await i.reply({content: '➖ You have left the giveaway!', ephemeral: true});
        } else {
            giveaway.entries.add(i.user.id);
            await i.reply({content: '✅ You have entered the giveaway! Good luck! 🍀', ephemeral: true});
        }
        const embed = EmbedBuilder.from(i.message.embeds[0])
            .setDescription(i.message.embeds[0].description.split('\n\n')[0] + `\n\n🎁 Click the button below to enter!\n👥 **${giveaway.entries.size}** ${giveaway.entries.size === 1 ? 'entry' : 'entries'}`);

        await i.message.edit({embeds: [embed]});
    }
});
async function endGiveaway(messageId) {
    const giveaway = activeGiveaways.get(messageId);
    if (!giveaway || giveaway.ended) return;
    giveaway.ended = true;
    try {
        const channel = await client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(messageId);
        let winners = [];
        const entries = Array.from(giveaway.entries);
        if (entries.length === 0) {
            const embed = new EB()
                .setColor('#FF0000')
                .setTitle('🎉 GIVEAWAY ENDED 🎉')
                .setDescription(`**Prize:** ${giveaway.prize}\n\n❌ **No valid entries!**\nNo one entered this giveaway.`)
                .setFooter({text: `Hosted by ${(await client.users.fetch(giveaway.hostId)).tag}`, iconURL: (await client.users.fetch(giveaway.hostId)).displayAvatarURL()})
                .setTimestamp();

            await message.edit({embeds: [embed], components: []});
            return;
        }
            const shuffled = [...entries].sort(() => Math.random() - 0.5);
            winners = shuffled.slice(0, Math.min(giveaway.winners, entries.length));
        }}
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        const winnerTags = [];
        for (const winnerId of winners) {
            try {
                const user = await client.users.fetch(winnerId);
                winnerTags.push(user.tag);
            } catch {
                winnerTags.push('Unknown User');
            }
        }
        const embed = new EB()
            .setColor('#00FF00')
            .setTitle('🎉 GIVEAWAY ENDED 🎉')
            .setDescription(`**Prize:** ${giveaway.prize}\n\n🏆 **Winner${winners.length > 1 ? 's' : ''}:** ${winnerMentions}\n\nCongratulations! 🎊`)
            .setFooter({text: `Hosted by ${(await client.users.fetch(giveaway.hostId)).tag} • ${giveaway.entries.size} entries`, iconURL: (await client.users.fetch(giveaway.hostId)).displayAvatarURL()})
            .setTimestamp();

        await message.edit({embeds: [embed], components: []});
        await message.reply(`🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`);

    } catch (error) {
        console.error('Error ending giveaway:', error);
    }
}
async function rerollGiveaway(messageId, interaction) {
    const giveaway = activeGiveaways.get(messageId);
    if (!giveaway) return;
    try {
        const channel = await client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(messageId);
        const entries = Array.from(giveaway.entries);
        if (entries.length === 0) {
            return interaction.reply({content: '❌ No entries to reroll from.', ephemeral: true});
        }
        let winners = [];
 for (let i = 1; i < giveaway.winners && remainingEntries.length > 0; i++) {
const randomIndex = Math.floor(Math.random() * remainingEntries.length);
 winners.push(remainingEntries.splice(randomIndex, 1)[0]);
            }
            const shuffled = [...entries].sort(() => Math.random() - 0.5);
            winners = shuffled.slice(0, Math.min(giveaway.winners, entries.length));
        }
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        const embed = new EB()
            .setColor('#FFD700')
            .setTitle('🎉 GIVEAWAY REROLLED 🎉')
            .setDescription(`**Prize:** ${giveaway.prize}\n\n🏆 **New Winner${winners.length > 1 ? 's' : ''}:** ${winnerMentions}\n\nCongratulations! 🎊`)
            .setFooter({text: `Hosted by ${(await client.users.fetch(giveaway.hostId)).tag} • Rerolled • ${giveaway.entries.size} entries`, iconURL: (await client.users.fetch(giveaway.hostId)).displayAvatarURL()})
            .setTimestamp();
        await message.edit({embeds: [embed]});
        await message.reply(`🔄 **REROLL!** Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`);
        await interaction.reply({content: '✅ Giveaway rerolled!', ephemeral: true});
    } catch (error) {
        console.error('Error rerolling giveaway:', error);
        await interaction.reply({content: '❌ Failed to reroll giveaway.', ephemeral: true});
    }
}


function jsonToCsv(data) {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row =>
        headers.map(header => {
            const value = row[header];
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',')
    );
    return [csvHeaders, ...csvRows].join('\n');
}
async function exportDatabaseTables() {
    const channelId = '1403603104502644807';
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
        console.error(`Channel ${channelId} not found`);
        return;
    }

    try {
        const tables = ['snowfall_players', 'players', 'gamemode_scores'];
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        let exportedCount = 0;
        const statusEmbed = new EmbedBuilder()
            .setTitle('📊 Starting Database Export')
            .setDescription('Exporting database tables...')
            .setColor(0x00AE86)
            .setTimestamp();
        await channel.send({ embeds: [statusEmbed] });
        for (const tableName of tables) {
            try {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*');

                if (error) {
                    console.error(`Error fetching ${tableName}:`, error);
                    const errorEmbed = new EmbedBuilder()
                        .setTitle(`❌ ${tableName} Export Failed`)
                        .setDescription(`Error: ${error.message}`)
                        .setColor(0xFF0000)
                        .setTimestamp();

                    await channel.send({ embeds: [errorEmbed] });
                    continue;
                }
                if (data && data.length > 0) {
                    const csvData = jsonToCsv(data);
                    const buffer = Buffer.from(csvData, 'utf-8');
                    const attachment = new AttachmentBuilder(buffer, {
                        name: `${tableName}_${timestamp}.csv`
                    });
                    const tableEmbed = new EmbedBuilder()
                        .setTitle(`📋 ${tableName}`)
                        .setDescription(`Successfully exported ${data.length} records`)
                        .addFields(
                            { name: 'Records Count', value: data.length.toString(), inline: true },
                            { name: 'Export Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                            { name: 'File Size', value: `${(buffer.length / 1024).toFixed(2)} KB`, inline: true }
                        )
                        .setColor(0x00AE86)
                        .setTimestamp();
                    await channel.send({
                        embeds: [tableEmbed],
                        files: [attachment]
                    });
                    exportedCount++;
                    console.log(`Successfully exported ${tableName} with ${data.length} records`);
                } else {
                    const emptyEmbed = new EmbedBuilder()
                        .setTitle(`📋 ${tableName}`)
                        .setDescription('No data found in this table')
                        .setColor(0xFFA500)
                        .setTimestamp();

                    await channel.send({ embeds: [emptyEmbed] });
                    console.log(`Table ${tableName} is empty`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (tableError) {
                console.error(`Error processing table ${tableName}:`, tableError);
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`❌ ${tableName} Export Error`)
                    .setDescription(`Failed to process table: ${tableError.message}`)
                    .setColor(0xFF0000)
                    .setTimestamp();
                await channel.send({ embeds: [errorEmbed] });
            }
        }
        const summaryEmbed = new EmbedBuilder()
            .setTitle('✅ Database Export Complete')
            .setDescription(`Export process finished`)
            .addFields(
                { name: 'Tables Processed', value: tables.length.toString(), inline: true },
                { name: 'Successfully Exported', value: exportedCount.toString(), inline: true },
                { name: 'Completion Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setColor(0x00FF00)
            .setTimestamp();
        await channel.send({ embeds: [summaryEmbed] });
    } catch (error) {
        console.error('Critical error during database export:', error);
        const criticalErrorEmbed = new EmbedBuilder()
            .setTitle('🚨 Critical Export Error')
            .setDescription('A critical error occurred during the database export process')
            .addFields(
                { name: 'Error', value: error.message || 'Unknown error', inline: false }
            )
            .setColor(0xFF0000)
            .setTimestamp();

        await channel.send({ embeds: [criticalErrorEmbed] });
    }
}
client.once('ready', () => {
    console.log('Bot is ready! Starting database export scheduler...');
    setInterval(exportDatabaseTables, 24 * 60 * 60 * 1000);
});

client.on('messageCreate', async (message) => {
    if (message.content === '!export-db' && message.author.id === '510847369454026753') {
        await exportDatabaseTables();
    }
});
async function scrapeMessages(sourceChannelId, targetChannelId) {
    const sourceChannel = client.channels.cache.get(sourceChannelId);
    const targetChannel = client.channels.cache.get(targetChannelId);

    if (!sourceChannel) {
        console.error(`Source channel ${sourceChannelId} not found`);
        return;
    }

    if (!targetChannel) {
        console.error(`Target channel ${targetChannelId} not found`);
        return;
    }

    try {
        const statusEmbed = new EmbedBuilder()
            .setTitle('🔍 Starting Message Scraping')
            .setDescription(`Scraping messages from <#${sourceChannelId}>...`)
            .setColor(0x00AE86)
            .setTimestamp();

        const statusMessage = await targetChannel.send({ embeds: [statusEmbed] });
        const allMessages = [];
        let lastMessageId = null;
        let totalMessages = 0;
        const batchSize = 100; 
        while (true) {
            const options = { limit: batchSize };
            if (lastMessageId) {
                options.before = lastMessageId;
            }
            const messages = await sourceChannel.messages.fetch(options);

            if (messages.size === 0) {
                break; 
            }
            messages.forEach(message => {
                const messageData = {
                    id: message.id,
                    author: {
                        id: message.author.id,
                        username: message.author.username,
                        displayName: message.author.displayName,
                        bot: message.author.bot
                    },
                    content: message.content,
                    timestamp: message.createdTimestamp,
                    createdAt: message.createdAt.toISOString(),
                    editedAt: message.editedAt ? message.editedAt.toISOString() : null,
                    attachments: message.attachments.map(att => ({
                        id: att.id,
                        name: att.name,
                        url: att.url,
                        size: att.size,
                        contentType: att.contentType
                    })),
                    embeds: message.embeds.map(embed => ({
                        title: embed.title,
                        description: embed.description,
                        url: embed.url,
                        color: embed.color,
                        timestamp: embed.timestamp,
                        fields: embed.fields,
                        author: embed.author,
                        footer: embed.footer,
                        image: embed.image,
                        thumbnail: embed.thumbnail
                    })),
                    reactions: message.reactions.cache.map(reaction => ({
                        emoji: reaction.emoji.name,
                        count: reaction.count,
                        users: reaction.users.cache.map(user => ({
                            id: user.id,
                            username: user.username
                        }))
                    })),
                    mentions: {
                        users: message.mentions.users.map(user => ({
                            id: user.id,
                            username: user.username
                        })),
                        roles: message.mentions.roles.map(role => ({
                            id: role.id,
                            name: role.name
                        })),
                        channels: message.mentions.channels.map(channel => ({
                            id: channel.id,
                            name: channel.name,
                            type: channel.type
                        }))
                    },
                    type: message.type,
                    system: message.system,
                    pinned: message.pinned,
                    tts: message.tts,
                    reference: message.reference ? {
                        messageId: message.reference.messageId,
                        channelId: message.reference.channelId,
                        guildId: message.reference.guildId
                    } : null
                };
                allMessages.push(messageData);
            });

            totalMessages += messages.size;
            lastMessageId = messages.last().id;
            if (totalMessages % 500 === 0) {
                const updateEmbed = new EmbedBuilder()
                    .setTitle('🔍 Scraping Messages')
                    .setDescription(`Progress: ${totalMessages} messages scraped...`)
                    .setColor(0xFFA500)
                    .setTimestamp();

                await statusMessage.edit({ embeds: [updateEmbed] });
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        allMessages.sort((a, b) => a.timestamp - b.timestamp);
        const jsonData = {
            metadata: {
                channelId: sourceChannelId,
                channelName: sourceChannel.name,
                guildId: sourceChannel.guild.id,
                guildName: sourceChannel.guild.name,
                totalMessages: allMessages.length,
                scrapedAt: new Date().toISOString(),
                oldestMessage: allMessages.length > 0 ? allMessages[0].createdAt : null,
                newestMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1].createdAt : null
            },
            messages: allMessages
        };
        const jsonString = JSON.stringify(jsonData, null, 2);
        const buffer = Buffer.from(jsonString, 'utf-8');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `messages_${sourceChannel.name}_${timestamp}.json`;
        const attachment = new AttachmentBuilder(buffer, { name: filename });
        const completionEmbed = new EmbedBuilder()
            .setTitle('✅ Message Scraping Complete')
            .setDescription(`Successfully scraped messages from <#${sourceChannelId}>`)
            .addFields(
                { name: 'Total Messages', value: allMessages.length.toString(), inline: true },
                { name: 'File Size', value: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`, inline: true },
                { name: 'Time Range', value: allMessages.length > 0 ?
                        `${new Date(allMessages[0].timestamp).toLocaleDateString()} - ${new Date(allMessages[allMessages.length - 1].timestamp).toLocaleDateString()}`
                        : 'No messages', inline: false },
                { name: 'Scraped At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setColor(0x00FF00)
            .setTimestamp();
        await targetChannel.send({
            embeds: [completionEmbed],
            files: [attachment]
        });
        console.log(`Successfully scraped ${allMessages.length} messages from channel ${sourceChannelId}`);
    } catch (error) {
        console.error('Error during message scraping:', error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Message Scraping Failed')
            .setDescription('An error occurred during message scraping')
            .addFields(
                { name: 'Error', value: error.message || 'Unknown error', inline: false }
            )
            .setColor(0xFF0000)
            .setTimestamp();
        await targetChannel.send({ embeds: [errorEmbed] });
    }
}
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.toLowerCase() === '!scrape-messages') {
        const sourceChannelId = '1389384461984075959';
        const targetChannelId = '1362109759133585590';
        await message.reply('🔍 Starting message scraping process...');
        await scrapeMessages(sourceChannelId, targetChannelId);
    }
});
['SIGINT','SIGTERM'].forEach(s=>process.on(s,()=>{h.saveLogs();process.exit(0);})); //THIS RESTARTS PM2
setInterval(()=>h.saveLogs(),5*60*1000);
try{
    let t=process.env.DISCORD_TOKEN;
    if(!t&&fs.existsSync('./.env')){const e=fs.readFileSync('./.env','utf8');const m=e.match(/DISCORD_TOKEN=(.+)/);if(m&&m[1])t=m[1].trim();}
    if(!t){console.error('ERROR: Bot token not found!');process.exit(1);}
    client.login(t);
}catch(e){console.error('Login error:',e);process.exit(1);}
