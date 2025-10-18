const { createCanvas, loadImage, registerFont } = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

function formatTierForDisplay(tier) {
  if (!tier) return tier;
  return tier.replace(/\+/g, ' PLUS');
}

function loadEloData() {
  try {
    const eloFilePath = path.join(__dirname, '..', 'elo.json');
    if (fs.existsSync(eloFilePath)) {
      const eloData = JSON.parse(fs.readFileSync(eloFilePath, 'utf8'));
      console.log('✅ ELO data loaded successfully from:', eloFilePath);
      return eloData;
    } else {
      console.log('❌ ELO file not found at:', eloFilePath);
      return {};
    }
  } catch (error) {
    console.error('❌ Error loading ELO data:', error);
    return {};
  }
}

function calculateLeaderboardPosition(userData, allEloData = null) {
  console.log('=== LEADERBOARD CALCULATION START ===');
  console.log('userData:', { 
    id: userData?.id, 
    username: userData?.username,
    hasId: !!userData?.id,
    hasUsername: !!userData?.username
  });
  
  if (!userData) {
    console.log('❌ userData is null/undefined');
    return 'N/A';
  }
  
  const hasId = userData.id !== undefined && userData.id !== null && userData.id !== '';
  const hasUsername = userData.username !== undefined && userData.username !== null && userData.username !== '';
  
  if (!hasId && !hasUsername) {
    console.log('❌ Neither userData.id nor userData.username is available');
    return 'N/A';
  }
  
  if (!allEloData) {
    console.log('Loading ELO data from file...');
    allEloData = loadEloData();
  }
  
  console.log('allEloData exists:', !!allEloData);
  console.log('allEloData keys count:', allEloData ? Object.keys(allEloData).length : 0);
  
  if (!allEloData) {
    console.log('❌ allEloData is null/undefined');
    return 'N/A';
  }
  
  if (Object.keys(allEloData).length === 0) {
    console.log('❌ allEloData is empty');
    return 'N/A';
  }
  
  try {
    const sampleKey = Object.keys(allEloData)[0];
    console.log('Sample data structure:', {
      key: sampleKey,
      value: allEloData[sampleKey]
    });
    
    const players = [];
    
    for (const [userId, playerData] of Object.entries(allEloData)) {
      if (playerData && typeof playerData.elo === 'number') {
        players.push({
          userId: userId,
          username: playerData.username,
          elo: playerData.elo
        });
      } else {
        console.log(`⚠️ Invalid player data for ${userId}:`, playerData);
      }
    }
    
    console.log('Valid players found:', players.length);
    
    if (players.length === 0) {
      console.log('❌ No valid players with ELO data');
      return 'N/A';
    }
    
    const sortedPlayers = players.sort((a, b) => b.elo - a.elo);
    
    console.log('Looking for user ID:', userData.id);
    console.log('Looking for username:', userData.username);
    console.log('Available user IDs (first 5):', sortedPlayers.map(p => p.userId).slice(0, 5));
    console.log('Available usernames (first 5):', sortedPlayers.map(p => p.username).slice(0, 5));
    
    const playerPosition = sortedPlayers.findIndex(player => {
      if (hasId && player.userId === userData.id) {
        console.log('✅ Found match by exact ID:', player.userId);
        return true;
      }
      
      if (hasId && (player.userId === userData.id.toString() || player.userId.toString() === userData.id.toString())) {
        console.log('✅ Found match by ID string conversion:', player.userId);
        return true;
      }
      
      if (hasUsername && player.username === userData.username) {
        console.log('✅ Found match by exact username:', player.username);
        return true;
      }
      
      if (hasUsername && player.username && userData.username && 
          player.username.toLowerCase() === userData.username.toLowerCase()) {
        console.log('✅ Found match by case-insensitive username:', player.username);
        return true;
      }
      
      return false;
    });
    
    if (playerPosition !== -1) {
      const position = playerPosition + 1;
      console.log('✅ Final position:', position);
      return position.toString();
    } else {
      console.log('❌ Player not found in leaderboard');
      console.log('Search criteria used:', {
        searchedById: hasId,
        searchedByUsername: hasUsername,
        idValue: userData.id,
        usernameValue: userData.username
      });
      return 'N/A';
    }
    
  } catch (error) {
    console.error('❌ Error in calculateLeaderboardPosition:', error);
    return 'N/A';
  }
}

async function generateEloImage(userData, eloData, tierInfo, allEloData = null) {
  const canvas = createCanvas(1152, 648);
  const ctx = canvas.getContext('2d');
  
  try {
    if (!userData) {
      throw new Error('userData is required');
    }
    
    if (!eloData) {
      throw new Error('eloData is required');
    }
    
    if (!tierInfo || typeof tierInfo !== 'object') {
      console.log('⚠️ tierInfo is missing or invalid, using empty object');
      tierInfo = {};
    }
    
    let fontFamily = 'Arial, sans-serif';
    let customFontLoaded = false;
    
    const fontConfigs = [
      { path: path.join(__dirname, 'minecraft.ttf'), family: 'Mojangles Extended' },
      { path: path.join(__dirname, 'minecraft.tff'), family: 'Minecraft' },
      { path: path.join(__dirname, 'mojangles.ttf'), family: 'Mojangles Extended' },
      { path: path.join(__dirname, 'fonts', 'minecraft.ttf'), family: 'Minecraft' },
      { path: path.join(__dirname, 'fonts', 'minecraft.tff'), family: 'Minecraft' },
      { path: path.join(__dirname, 'fonts', 'mojangles.ttf'), family: 'Mojangles' }
    ];
    
    for (const config of fontConfigs) {
      try {
        if (fs.existsSync(config.path)) {
          registerFont(config.path, { family: config.family });
          fontFamily = config.family;
          customFontLoaded = true;
          console.log(`Font loaded successfully: ${config.path} as "${config.family}"`);
          break;
        }
      } catch (err) {
        console.log(`Failed to load font ${config.path}:`, err.message);
      }
    }
    
    if (!customFontLoaded) {
      console.log('No custom fonts found, using system fallback');
    }
    
    const backgroundPath = path.join(__dirname, 'background1.png');
    let backgroundImage;
    
    if (fs.existsSync(backgroundPath)) {
      backgroundImage = await loadImage(backgroundPath);
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#2C1810');
      gradient.addColorStop(1, '#1A0F08');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    let userAvatar;
    try {
      if (userData.avatarURL) {
        let avatarUrl = userData.avatarURL.replace(/\.(webp|gif)(\?.*)?$/, '.png$2');
        if (!avatarUrl.includes('?')) {
          avatarUrl += '?size=256&format=png';
        } else if (!avatarUrl.includes('format=')) {
          avatarUrl += '&format=png';
        }
        
        const response = await fetch(avatarUrl, {
          headers: {
            'User-Agent': 'DiscordBot (https://discord.js.org, 1.0.0)',
            'Accept': 'image/png, image/jpeg, image/webp, */*'
          },
          timeout: 5000
        });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.startsWith('image/')) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            userAvatar = await loadImage(buffer);
          }
        }
      }
    } catch (err) {
      console.log('Could not load user avatar:', err.message);
      userAvatar = null;
    }
    
    const displayUsername = userData.username || 'Unknown User';
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, 80);
    ctx.restore();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 32px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(displayUsername, canvas.width / 2, 50);
    
    const leftPanelX = 50;
    const leftPanelY = 120;
    const leftPanelWidth = 350;
    const leftPanelHeight = 400;
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(leftPanelX, leftPanelY, leftPanelWidth, leftPanelHeight);
    ctx.restore();
    
    if (userAvatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(leftPanelX + 175, leftPanelY + 80, 50, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(userAvatar, leftPanelX + 125, leftPanelY + 30, 100, 100);
      ctx.restore();
      
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(leftPanelX + 175, leftPanelY + 80, 50, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.fillStyle = '#444444';
      ctx.beginPath();
      ctx.arc(leftPanelX + 175, leftPanelY + 80, 50, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `40px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', leftPanelX + 175, leftPanelY + 90);
      
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(leftPanelX + 175, leftPanelY + 80, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.fillStyle = eloData.color || '#FFFFFF';
    ctx.font = `bold 24px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(eloData.rank || 'Unranked', leftPanelX + 175, leftPanelY + 180);
    
    if (Object.keys(tierInfo).length > 0) {
      ctx.fillStyle = '#FFC107';
      ctx.font = `bold 18px ${fontFamily}`;
      ctx.textAlign = 'left';
      ctx.fillText('TIER RANKINGS', leftPanelX + 20, leftPanelY + 220);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `16px ${fontFamily}`;
      let yPos = leftPanelY + 245;
      
      let count = 0;
      for (const [gamemode, tier] of Object.entries(tierInfo)) {
        if (count >= 6) break;
        
        const formattedGamemode = gamemode.charAt(0).toUpperCase() + gamemode.slice(1);
        ctx.fillText(`${formattedGamemode}  ${formatTierForDisplay(tier)} Tier`, leftPanelX + 20, yPos);
        yPos += 25;
        count++;
      }
    } else {
      ctx.fillStyle = '#888888';
      ctx.font = `16px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillText('No tier data available', leftPanelX + 175, leftPanelY + 250);
    }
    
    let leaderboardPosition = calculateLeaderboardPosition(userData, allEloData);
    
    const rightPanelX = 450;
    const rightPanelY = 120;
    const rightPanelWidth = 650;
    const rightPanelHeight = 400;
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(rightPanelX, rightPanelY, rightPanelWidth, 60);
    ctx.restore();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 28px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.fillText('PERFORMANCE', rightPanelX + 20, rightPanelY + 40);
    
    const boxWidth = (rightPanelWidth - 60) / 2;
    const boxHeight = (rightPanelHeight - 100) / 2;
    
    const box1X = rightPanelX + 20;
    const box1Y = rightPanelY + 80;
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(box1X, box1Y, boxWidth, boxHeight);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(box1X, box1Y, boxWidth, boxHeight);
    ctx.restore();
    
    ctx.fillStyle = '#FF69B4';
    ctx.font = `bold 16px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('ELO', box1X + boxWidth/2, box1Y + 30);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 36px ${fontFamily}`;
    ctx.fillText((eloData.elo || 0).toString(), box1X + boxWidth/2, box1Y + 80);
    
    const box2X = rightPanelX + 40 + boxWidth;
    const box2Y = rightPanelY + 80;
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(box2X, box2Y, boxWidth, boxHeight);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(box2X, box2Y, boxWidth, boxHeight);
    ctx.restore();
    
    ctx.fillStyle = '#4CAF50';
    ctx.font = `bold 16px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('WEEKLY CHANGE', box2X + boxWidth/2, box2Y + 30);
    
    const weeklyChange = eloData.weeklyChange || 0;
    const weeklyColor = weeklyChange > 0 ? '#4CAF50' : 
                       weeklyChange < 0 ? '#FF5252' : '#FFC107';
    ctx.fillStyle = weeklyColor;
    ctx.font = `bold 36px ${fontFamily}`;
    const weeklyText = weeklyChange > 0 ? `${weeklyChange}` : weeklyChange.toString();
    ctx.fillText(weeklyText, box2X + boxWidth/2, box2Y + 80);
    
    const box3X = rightPanelX + 20;
    const box3Y = rightPanelY + 100 + boxHeight;
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(box3X, box3Y, boxWidth, boxHeight);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(box3X, box3Y, boxWidth, boxHeight);
    ctx.restore();
    
    ctx.fillStyle = '#2196F3';
    ctx.font = `bold 16px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('LEADERBOARD', box3X + boxWidth/2, box3Y + 25);
    ctx.fillText('POSITION', box3X + boxWidth/2, box3Y + 45);
    
    let positionColor = '#FFFFFF';
    if (leaderboardPosition !== 'NA') {
      const position = parseInt(leaderboardPosition);
      if (position === 1) positionColor = '#FFD700';
      else if (position === 2) positionColor = '#C0C0C0';
      else if (position === 3) positionColor = '#CD7F32';
      else if (position <= 10) positionColor = '#00FF00';
    }
    
    ctx.fillStyle = positionColor;
    ctx.font = `bold 36px ${fontFamily}`;
    ctx.fillText(leaderboardPosition, box3X + boxWidth/2, box3Y + 85);
    
    const box4X = rightPanelX + 40 + boxWidth;
    const box4Y = rightPanelY + 100 + boxHeight;
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(box4X, box4Y, boxWidth, boxHeight);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(box4X, box4Y, boxWidth, boxHeight);
    ctx.restore();
    
    ctx.fillStyle = '#9C27B0';
    ctx.font = `bold 16px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('BEST TIER', box4X + boxWidth/2, box4Y + 30);
    
    let bestTier = 'None';
    if (Object.keys(tierInfo).length > 0) {
      const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'E'];
      for (const tier of tierOrder) {
        if (Object.values(tierInfo).includes(tier)) {
          bestTier = tier;
          break;
        }
      }
    }
    
    let tierColor = '#FFFFFF';
    const originalTier = bestTier;
    if (originalTier === 'S+') tierColor = '#FFFFFF';
    else if (originalTier === 'S') tierColor = '#11806a';
    else if (originalTier === 'A') tierColor = '#1f8b4c';
    else if (originalTier === 'B') tierColor = '#206694';
    else if (originalTier === 'C') tierColor = '#71368a';
    else if (originalTier === 'D') tierColor = '#ad1457';
    else if (originalTier === 'E') tierColor = '#992d22';

    ctx.fillStyle = tierColor;
    ctx.font = `bold 36px ${fontFamily}`;
    ctx.fillText(formatTierForDisplay(bestTier), box4X + boxWidth/2, box4Y + 80);    
    
    return canvas.toBuffer('image/png');
    
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}

function cleanUsername(username) {
  return username
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[_;:]/g, '')
    .trim();
}

async function generateEloLeaderboardImage(eloData) {
  const canvas = createCanvas(1152, 648);
  const ctx = canvas.getContext('2d');
  
  try {
    let fontFamily = 'Arial, sans-serif';
    let customFontLoaded = false;
    
    const fontConfigs = [
      { path: path.join(__dirname, 'minecraft.ttf'), family: 'Mojangles Extended' },
      { path: path.join(__dirname, 'minecraft.tff'), family: 'Minecraft' },
      { path: path.join(__dirname, 'mojangles.ttf'), family: 'Mojangles Extended' },
      { path: path.join(__dirname, 'fonts', 'minecraft.ttf'), family: 'Minecraft' },
      { path: path.join(__dirname, 'fonts', 'minecraft.tff'), family: 'Minecraft' },
      { path: path.join(__dirname, 'fonts', 'mojangles.ttf'), family: 'Mojangles' }
    ];
    
    for (const config of fontConfigs) {
      try {
        if (fs.existsSync(config.path)) {
          registerFont(config.path, { family: config.family });
          fontFamily = config.family;
          customFontLoaded = true;
          console.log(`Font loaded successfully: ${config.path} as "${config.family}"`);
          break;
        }
      } catch (err) {
        console.log(`Failed to load font ${config.path}:`, err.message);
      }
    }
    
    const backgroundPath = path.join(__dirname, 'background.png');
    let backgroundImage;
    
    if (fs.existsSync(backgroundPath)) {
      backgroundImage = await loadImage(backgroundPath);
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
      const gradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width/2);
      gradient.addColorStop(0, '#1a4b5c');
      gradient.addColorStop(0.7, '#0f2a33');
      gradient.addColorStop(1, '#051218');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < 100; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    const sortedPlayers = Object.values(eloData)
      .filter(player => player && typeof player.elo === 'number')
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 10);
    
    const panelX = 120;
    const panelY = 60;
    const panelWidth = 912;
    const panelHeight = 420;
    
    const cornerSize = 40;
    const cornerThickness = 6;
    
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    ctx.fillStyle = '#FFD700';
    
    ctx.fillRect(panelX - 25, panelY - 25, cornerSize, cornerThickness);
    ctx.fillRect(panelX - 25, panelY - 25, cornerThickness, cornerSize);
    
    ctx.fillRect(panelX + panelWidth - 15, panelY - 25, cornerSize, cornerThickness);
    ctx.fillRect(panelX + panelWidth + 19, panelY - 25, cornerThickness, cornerSize);
    
    ctx.fillRect(panelX - 25, panelY + panelHeight + 19, cornerSize, cornerThickness);
    ctx.fillRect(panelX - 25, panelY + panelHeight - 15, cornerThickness, cornerSize);
    
    ctx.fillRect(panelX + panelWidth - 15, panelY + panelHeight + 19, cornerSize, cornerThickness);
    ctx.fillRect(panelX + panelWidth + 19, panelY + panelHeight - 15, cornerThickness, cornerSize);
    
    ctx.shadowBlur = 0;
    
    const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    panelGradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    panelGradient.addColorStop(0.5, 'rgba(15, 15, 15, 0.8)');
    panelGradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    ctx.fillStyle = panelGradient;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 8, panelY + 8, panelWidth - 16, panelHeight - 16);
    
    const titleHeight = 90;
    
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(panelX + 40, panelY + titleHeight);
    ctx.lineTo(panelX + panelWidth - 40, panelY + titleHeight);
    ctx.stroke();
    
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 25;
    
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold 40px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText('ELO', panelX + panelWidth/2, panelY + 40);
    
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FF8C00';
    ctx.font = `bold 30px ${fontFamily}`;
    ctx.fillText('LEADERBOARD', panelX + panelWidth/2, panelY + 72);
    
    ctx.shadowBlur = 0;
    
    const contentStartY = panelY + titleHeight + 40;
    const leftColX = panelX + 60;
    const rightColX = panelX + panelWidth/2 + 60;
    const colWidth = (panelWidth/2) - 80;
    
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold 28px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.fillText('TOP 5', leftColX, contentStartY);
    ctx.fillText('6 to 10', rightColX, contentStartY);
    
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftColX, contentStartY + 8);
    ctx.lineTo(leftColX + 100, contentStartY + 8);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(rightColX, contentStartY + 8);
    ctx.lineTo(rightColX + 80, contentStartY + 8);
    ctx.stroke();
    
    const entryHeight = 36;
    const startY = contentStartY + 30;
    
    function getRankStyling(rank) {
      switch(rank) {
        case 1: return { color: '#FFD700', shadow: '#FFD700', size: '24px' };
        case 2: return { color: '#C0C0C0', shadow: '#C0C0C0', size: '22px' };
        case 3: return { color: '#CD7F32', shadow: '#CD7F32', size: '22px' };
        default: return { color: '#FFFFFF', shadow: '#FFFFFF', size: '20px' };
      }
    }
    
    for (let i = 0; i < Math.min(5, sortedPlayers.length); i++) {
      const player = sortedPlayers[i];
      const yPos = startY + (i * entryHeight);
      const rankStyle = getRankStyling(i + 1);
      
      if (i < 3) {
        const entryGradient = ctx.createLinearGradient(leftColX - 20, yPos - 12, leftColX + colWidth, yPos - 12);
        entryGradient.addColorStop(0, `rgba(${i === 0 ? '255,215,0' : i === 1 ? '192,192,192' : '205,127,50'}, 0.2)`);
        entryGradient.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = entryGradient;
        ctx.fillRect(leftColX - 20, yPos - 16, colWidth + 20, entryHeight - 4);
      }
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = rankStyle.color;
      ctx.font = `bold ${rankStyle.size} ${fontFamily}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}`, leftColX, yPos);
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      let playerName = cleanUsername(player.username);
      if (playerName.length > 16) {
        playerName = playerName.substring(0, 13) + '...';
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `19px ${fontFamily}`;
      ctx.fillText(playerName, leftColX + 45, yPos);
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold 19px ${fontFamily}`;
      ctx.textAlign = 'right';
      ctx.fillText(player.elo.toString(), leftColX + colWidth, yPos);
      
      if (i < 4) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftColX, yPos + 12);
        ctx.lineTo(leftColX + colWidth - 20, yPos + 12);
        ctx.stroke();
      }
    }
    
    for (let i = 5; i < Math.min(10, sortedPlayers.length); i++) {
      const player = sortedPlayers[i];
      const yPos = startY + ((i - 5) * entryHeight);
      const rankStyle = getRankStyling(i + 1);
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = rankStyle.color;
      ctx.font = `bold ${rankStyle.size} ${fontFamily}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}`, rightColX, yPos);
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 2;
      
      let playerName = cleanUsername(player.username);
      if (playerName.length > 16) {
        playerName = playerName.substring(0, 13) + '...';
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `19px ${fontFamily}`;
      ctx.fillText(playerName, rightColX + 45, yPos);
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold 19px ${fontFamily}`;
      ctx.textAlign = 'right';
      ctx.fillText(player.elo.toString(), rightColX + colWidth, yPos);
      
      if (i < 9 && i < sortedPlayers.length - 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rightColX, yPos + 12);
        ctx.lineTo(rightColX + colWidth - 20, yPos + 12);
        ctx.stroke();
      }
    }
    
    const footerY = panelY + panelHeight - 25;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `14px ${fontFamily}`;
    ctx.textAlign = 'center';
    const totalPlayers = Object.keys(eloData).length;
    ctx.fillText(`Total Players  ${totalPlayers}   Generated ${new Date().toLocaleDateString().replace(/\//g, ' ')}`, panelX + panelWidth/2, footerY);
    
    return canvas.toBuffer('image/png');
    
  } catch (error) {
    console.error('Error generating leaderboard image:', error);
    throw error;
  }
}

module.exports = { generateEloImage, generateEloLeaderboardImage, cleanUsername, calculateLeaderboardPosition, formatTierForDisplay };