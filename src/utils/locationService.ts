/**
 * 位置定位、距离计算、500m/24h 本地缓存与 POI 扫描服务
 */

export interface ScannedPoiItem {
  id: string;
  name: string;
  address: string;
  distance: number; // 单位：米
  location?: { lng: number; lat: number };
  type?: string;
  tel?: string;
}

export interface NearbyScanCacheData {
  lat: number;
  lng: number;
  timestamp: number; // 毫秒
  radius: number;
  pois: ScannedPoiItem[];
  organizedResults?: any[]; // AI 整理后的标准地点数组
}

const CACHE_KEY = 'bento_nearby_scan_cache_v1';
const MAX_CACHE_DISTANCE_METERS = 500; // 500米以内
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24小时

/**
 * 1. 使用 Haversine 公式计算两个经纬度之间的实际地理距离（单位：米）
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * 2. 获取浏览器当前地理位置 (HTML5 Geolocation API)
 */
export function getUserCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('您的浏览器不支持 HTML5 地理定位功能'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let msg = '获取位置失败';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = '已拒绝位置权限，无法自动获取当前位置';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = '位置信息不可用，请检查设备定位服务是否开启';
            break;
          case error.TIMEOUT:
            msg = '获取地理位置超时，请重试';
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * 3. 获取本地 500m 且 24小时内的有效扫描缓存
 */
export function getValidNearbyCache(
  currentLat: number,
  currentLng: number
): NearbyScanCacheData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cache: NearbyScanCacheData = JSON.parse(raw);
    const now = Date.now();

    // 检查时间是否超时 24 小时
    const age = now - cache.timestamp;
    if (age > MAX_CACHE_AGE_MS) {
      return null;
    }

    // 检查移动距离是否超过 500 米
    const dist = calculateDistance(currentLat, currentLng, cache.lat, cache.lng);
    if (dist > MAX_CACHE_DISTANCE_METERS) {
      return null;
    }

    return cache;
  } catch (e) {
    console.warn('[NearbyCache] 读取失败:', e);
    return null;
  }
}

/**
 * 4. 保存扫描及 AI 整理结果到本地缓存
 */
export function saveNearbyCache(data: {
  lat: number;
  lng: number;
  radius: number;
  pois: ScannedPoiItem[];
  organizedResults?: any[];
}) {
  try {
    const cacheData: NearbyScanCacheData = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('[NearbyCache] 写入缓存失败:', e);
  }
}

/**
 * 5. 清除缓存
 */
export function clearNearbyCache() {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * 6. 逆地理编码：将经纬度转换为人类可读的详细位置名称
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  amapKey?: string
): Promise<string> {
  const key = amapKey || (import.meta.env.VITE_AMAP_KEY as string);

  // 1. 如果配置了高德 API Key，使用高德逆地理编码
  if (key && key.trim()) {
    try {
      const url = `https://restapi.amap.com/v3/geocode/regeo?key=${key.trim()}&location=${lng},${lat}&extensions=base`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.regeocode) {
        const regeo = data.regeocode;
        const formatted = regeo.formatted_address;
        const addressComponent = regeo.addressComponent;
        const poiName = regeo.pois && regeo.pois.length > 0 ? regeo.pois[0].name : '';
        
        if (poiName) {
          return `${addressComponent.district || ''}${addressComponent.township || ''}·${poiName}`;
        }
        if (typeof formatted === 'string' && formatted.length > 0) {
          return formatted;
        }
      }
    } catch (err) {
      console.warn('[AMap Regeo Error]:', err);
    }
  }

  // 2. OpenStreetMap Nominatim 降级方案
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.address) {
      const addr = data.address;
      const spot = addr.amenity || addr.building || addr.road || addr.suburb || addr.city || '';
      if (spot) {
        return `${addr.city || addr.province || ''}${addr.suburb || ''}${spot}`;
      }
    }
  } catch (err) {
    console.warn('[OSM Regeo Error]:', err);
  }

  // 3. 兜底显示友好坐标说明
  return `当前 GPS 区域 (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`;
}

/**
 * 7. 扫描周边 POI (支持高德 Web API / 全套演示数据降级)
 */
export async function fetchNearbyPois(
  lat: number,
  lng: number,
  radius: number = 1000,
  amapKey?: string
): Promise<ScannedPoiItem[]> {
  const key = amapKey || (import.meta.env.VITE_AMAP_KEY as string);

  // 如果提供了高德 ApiKey，尝试通过高德 REST API 查询周边美食
  if (key && key.trim()) {
    try {
      const url = `https://restapi.amap.com/v3/place/around?key=${key.trim()}&location=${lng},${lat}&keywords=美食&types=050000&radius=${radius}&offset=15&page=1&extensions=all`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && Array.isArray(data.pois) && data.pois.length > 0) {
        return data.pois.map((p: any) => ({
          id: p.id || Math.random().toString(36).substr(2, 9),
          name: p.name,
          address: p.address || p.pname + p.cityname + p.adname,
          distance: parseInt(p.distance, 10) || Math.floor(Math.random() * 500) + 100,
          tel: p.tel,
          type: p.type,
        }));
      }
    } catch (err) {
      console.warn('[AMap Fetch Error], 降级使用智能模拟周边 POI:', err);
    }
  }

  // 兜底：根据当前坐标自动生成结构精美、接地气的本地真实感周边美食列表
  return generateMockNearbyPois(lat, lng, radius);
}

/**
 * 8. 根据手动指定的自定义位置名称/地址检索 POI
 */
export async function searchPoisByCustomLocation(
  locationName: string,
  radius: number = 1000,
  amapKey?: string
): Promise<{ pois: ScannedPoiItem[]; coords?: { lat: number; lng: number } }> {
  const key = amapKey || (import.meta.env.VITE_AMAP_KEY as string);
  const cleanLoc = locationName.trim();

  if (key && key.trim()) {
    try {
      // 先对自定义地名进行地理编码获取经纬度
      const geoUrl = `https://restapi.amap.com/v3/geocode/geo?key=${key.trim()}&address=${encodeURIComponent(cleanLoc)}`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (geoData.status === '1' && Array.isArray(geoData.geocodes) && geoData.geocodes.length > 0) {
        const first = geoData.geocodes[0];
        const [lngStr, latStr] = first.location.split(',');
        const lng = parseFloat(lngStr);
        const lat = parseFloat(latStr);

        const pois = await fetchNearbyPois(lat, lng, radius, key);
        return { pois, coords: { lat, lng } };
      }

      // 如果地理编码未直接命中，尝试文本直接检索 Place Text
      const textUrl = `https://restapi.amap.com/v3/place/text?key=${key.trim()}&keywords=${encodeURIComponent(cleanLoc + ' 美食')}&types=050000&offset=15&page=1`;
      const textRes = await fetch(textUrl);
      const textData = await textRes.json();

      if (textData.status === '1' && Array.isArray(textData.pois) && textData.pois.length > 0) {
        const pois = textData.pois.map((p: any) => ({
          id: p.id || Math.random().toString(36).substr(2, 9),
          name: p.name,
          address: p.address || p.pname + p.cityname + p.adname,
          distance: parseInt(p.distance, 10) || Math.floor(Math.random() * 500) + 100,
          tel: p.tel,
          type: p.type,
        }));
        return { pois };
      }
    } catch (err) {
      console.warn('[AMap Custom Search Error]:', err);
    }
  }

  // 降级：基于自定义位置名称生成定制化真实感 POI 数据
  const pois = generateCustomMockPois(cleanLoc, radius);
  return { pois };
}

/**
 * 智能生成真实感模拟周边 POI (当没有 API Key 或跨域受限时)
 */
function generateMockNearbyPois(lat: number, lng: number, radius: number): ScannedPoiItem[] {
  const pool = [
    { name: '小杨生煎 (科技园店)', type: '小吃快餐', address: '科技大道88号1层', baseDist: 150 },
    { name: '老成都川菜馆', type: '川菜/家常菜', address: '创业一路12号', baseDist: 280 },
    { name: '奈雪的茶 (商务中心店)', type: '茶饮甜品', address: '金融街广场A座', baseDist: 320 },
    { name: '沙县小吃 (旗舰店)', type: '中式快餐', address: '科技园区食堂街3号', baseDist: 90 },
    { name: '萨莉亚意式餐厅', type: '西式快餐', address: '万达广场3楼', baseDist: 450 },
    { name: '大卡司奶茶&鸡排', type: '饮品小吃', address: '步行街 108 号', baseDist: 520 },
    { name: '潮汕牛肉火锅', type: '火锅/正餐', address: '美食城2楼 201', baseDist: 680 },
    { name: '星巴克咖啡 (科技园店)', type: '咖啡轻食', address: '科技大厦1层大厅', baseDist: 210 },
    { name: '日式豚骨拉面馆', type: '日韩料理', address: '地下商业街 B1-15', baseDist: 390 },
    { name: '兰州正宗牛肉拉面', type: '面食小吃', address: '生活区便民街5号', baseDist: 180 },
    { name: '广式深井烧鹅饭', type: '粤菜快餐', address: '美食城1楼 105', baseDist: 610 },
    { name: '木屋烧烤 (深夜食堂)', type: '烧烤夜宵', address: '宵夜街 99 号', baseDist: 850 },
  ];

  return pool
    .filter((item) => item.baseDist <= radius + 200)
    .map((item, idx) => ({
      id: `mock_poi_${idx}_${Date.now()}`,
      name: item.name,
      address: item.address,
      distance: item.baseDist,
      type: item.type,
      location: {
        lat: lat + (Math.random() - 0.5) * 0.005,
        lng: lng + (Math.random() - 0.5) * 0.005,
      },
    }));
}

/**
 * 针对用户手动输入的自定义位置生成的周边真实感美食列表
 */
function generateCustomMockPois(locationName: string, radius: number): ScannedPoiItem[] {
  const locTag = locationName || '当前指定位置';
  const customPool = [
    { name: `老字号地道小吃 (${locTag}店)`, type: '地方特色小吃', address: `${locTag}美食街 16 号`, baseDist: 120 },
    { name: `精致快餐便当 (${locTag}中心店)`, type: '中式快餐', address: `${locTag}商业广场 B1`, baseDist: 210 },
    { name: `古法传统面馆 (${locTag}分支)`, type: '面食快餐', address: `${locTag}步行街 58 号`, baseDist: 350 },
    { name: `鲜萃手摇茶饮 (${locTag}店)`, type: '饮品甜点', address: `${locTag}主路 88 号`, baseDist: 180 },
    { name: `精品烘焙咖啡馆`, type: '咖啡轻食', address: `${locTag}写字楼大厅`, baseDist: 290 },
    { name: `招牌酸菜鱼 (${locTag}店)`, type: '正餐/家常菜', address: `${locTag}购物中心 3 楼`, baseDist: 480 },
    { name: `日式黑豚拉面`, type: '日韩料理', address: `${locTag}地下风情街`, baseDist: 520 },
    { name: `老北京涮羊肉 / 潮汕牛肉`, type: '特色火锅', address: `${locTag}美食汇 202`, baseDist: 650 },
  ];

  return customPool
    .filter((item) => item.baseDist <= radius + 300)
    .map((item, idx) => ({
      id: `custom_poi_${idx}_${Date.now()}`,
      name: item.name,
      address: item.address,
      distance: item.baseDist,
      type: item.type,
    }));
}

