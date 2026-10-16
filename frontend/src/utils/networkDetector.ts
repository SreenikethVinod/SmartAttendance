/**
 * Real Network & Wi-Fi Gateway Detector
 * Actively probes the client's live public IP, ISP/Network provider, and local network characteristics
 * to lock the current Wi-Fi as the base authorized classroom network and detect when the user switches networks.
 */

export interface LiveNetworkInfo {
  publicIp: string;
  isp: string;
  city?: string;
  country?: string;
  localIp?: string;
  timestamp: number;
  source: 'direct-client' | 'ipapi' | 'proxy' | 'fallback';
}

export interface BaseWifiProfile {
  baseIp: string;
  baseIsp: string;
  baseNetworkName: string;
  lockedAt: string;
  allowedSubnet?: string;
}

/**
 * Attempts to extract local subnet candidate using WebRTC RTCPeerConnection
 */
export async function getLocalNetworkCandidate(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('network_probe');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => resolve(null));
      
      let done = false;
      pc.onicecandidate = (event) => {
        if (!event || !event.candidate || !event.candidate.candidate) {
          if (!done) {
            done = true;
            try { pc.close(); } catch {}
            resolve(null);
          }
          return;
        }
        const candidate = event.candidate.candidate;
        const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
        if (ipMatch && !done) {
          done = true;
          try { pc.close(); } catch {}
          resolve(ipMatch[1]);
        }
      };

      setTimeout(() => {
        if (!done) {
          done = true;
          try { pc.close(); } catch {}
          resolve(null);
        }
      }, 1200);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Actively probes the user's real public IP and network provider
 */
export async function fetchLiveNetworkInfo(): Promise<LiveNetworkInfo> {
  const localIp = await getLocalNetworkCandidate();

  // Strategy 1: Fast direct probe to api.ipify.org
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        // Try to get ISP details from a secondary non-blocking lookup or infer
        let isp = 'Broadband / Wi-Fi Gateway';
        let city = '';
        try {
          const detailRes = await fetch(`https://ipapi.co/${data.ip}/json/`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            if (detailData.org || detailData.network) {
              isp = detailData.org || detailData.network;
              city = detailData.city || '';
            }
          }
        } catch {
          // ignore detail failure
        }

        return {
          publicIp: data.ip,
          isp,
          city,
          localIp: localIp || undefined,
          timestamp: Date.now(),
          source: 'direct-client',
        };
      }
    }
  } catch {
    // Strategy 1 failed, try next
  }

  // Strategy 2: ipwho.is probe
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return {
          publicIp: data.ip,
          isp: data.connection?.isp || data.connection?.org || 'Wi-Fi Network',
          city: data.city || '',
          country: data.country || '',
          localIp: localIp || undefined,
          timestamp: Date.now(),
          source: 'ipapi',
        };
      }
    }
  } catch {
    // Strategy 2 failed
  }

  // Strategy 3: Query local proxy endpoint /api/real-ip
  try {
    const res = await fetch('/api/real-ip');
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return {
          publicIp: data.ip,
          isp: 'Campus Gateway / ISP Network',
          localIp: localIp || undefined,
          timestamp: Date.now(),
          source: 'proxy',
        };
      }
    }
  } catch {
    // Strategy 3 failed
  }

  // Fallback: If completely offline
  return {
    publicIp: '192.168.1.104',
    isp: 'Local Wi-Fi Gateway',
    localIp: localIp || '192.168.1.104',
    timestamp: Date.now(),
    source: 'fallback',
  };
}

/**
 * Compare current network IP against the base authorized Wi-Fi network
 */
export function verifyWifiMatch(currentIp: string, baseIp: string): { isMatch: boolean; reason?: string } {
  const cleanCurrent = currentIp.trim();
  const cleanBase = baseIp.trim();

  if (!cleanBase || cleanBase === 'UNKNOWN') {
    return { isMatch: true };
  }

  // Exact IP match (standard for NAT broadband router)
  if (cleanCurrent === cleanBase) {
    return { isMatch: true };
  }

  // If both are IPv4, also check /24 subnet match in case of DHCP IP pool on same router
  const currentParts = cleanCurrent.split('.');
  const baseParts = cleanBase.split('.');
  if (currentParts.length === 4 && baseParts.length === 4) {
    if (
      currentParts[0] === baseParts[0] &&
      currentParts[1] === baseParts[1] &&
      currentParts[2] === baseParts[2]
    ) {
      return { isMatch: true };
    }
  }

  return {
    isMatch: false,
    reason: `Network Mismatch: Connected to IP ${cleanCurrent}, but attendance is locked to Classroom Base Wi-Fi (${cleanBase}).`,
  };
}
