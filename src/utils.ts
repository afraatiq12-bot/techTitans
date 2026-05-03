/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CATEGORIES, URGENCY_LEVELS } from './constants';
import { EmergencyCategory, UrgencyLevel } from './types';

export function classifyProblem(text: string): { category: EmergencyCategory; urgency: UrgencyLevel } {
  const lowerText = text.toLowerCase();
  
  // 1. Category Detection
  let detectedCategory: EmergencyCategory = 'general';
  let maxCategoryHits = 0;

  for (const [cat, config] of Object.entries(CATEGORIES)) {
    const hits = config.keywords.filter(keyword => lowerText.includes(keyword)).length;
    if (hits > maxCategoryHits) {
      maxCategoryHits = hits;
      detectedCategory = cat as EmergencyCategory;
    }
  }

  // 2. Urgency Scoring System
  let score = 0;

  // UTILITY SPECIFIC (Increases score for utility issues)
  const utilityKeywords = ['leak', 'outage', 'blackout', 'pothole', 'garbage', 'smell', 'blockage'];
  utilityKeywords.forEach(kw => { if (lowerText.includes(kw)) score += 3; });

  // CRITICAL KEYWORDS (+10 points)
  const criticalKeywords = [
    'dying', 'cannot breathe', 'not breathing', 'unconscious', 'bleeding heavily', 
    'shooting', 'stabbing', 'heart attack', 'stroke', 'collapsed', 'explosion',
    'kidnapping', 'trapped', 'drowning', 'suffocating'
  ];
  
  // HIGH ALARMS (+5 points)
  const highAlarmKeywords = [
    'fire', 'smoke', 'attack', 'emergency', 'help me', 'weapon', 'gun', 'knife',
    'serious', 'severe', 'urgent', 'danger', 'choking', 'poison', 'suicide'
  ];

  // WARNINGS (+2 points)
  const warningKeywords = [
    'accident', 'theft', 'pain', 'broken', 'sick', 'injury', 'robbery', 'crime',
    'blood', 'fever', 'burn', 'hit', 'fall'
  ];

  // SCORING
  criticalKeywords.forEach(kw => { if (lowerText.includes(kw)) score += 10; });
  highAlarmKeywords.forEach(kw => { if (lowerText.includes(kw)) score += 5; });
  warningKeywords.forEach(kw => { if (lowerText.includes(kw)) score += 2; });

  // 3. CONTEXT & SENTIMENT ENHANCEMENT
  
  // Repeated Exclamations (Intensity)
  if (text.includes('!!!')) score += 3;
  else if (text.includes('!')) score += 1;

  // Capitalization (Shouting)
  const upperCaseCount = (text.match(/[A-Z]/g) || []).length;
  if (upperCaseCount > 5 && upperCaseCount > text.length * 0.3) score += 3;

  // Specific High-Risk Subjects
  if (lowerText.includes('child') || lowerText.includes('baby') || lowerText.includes('kid')) {
    if (score > 0) score += 5; // Amplifies existing danger
  }

  // Length penalty (Longer usually means less immediate shock, though not always)
  if (text.length > 150) score -= 1;

  // 4. MAPPING SCORE TO URGENCY
  let urgency: UrgencyLevel = 'low';
  if (score >= 12) urgency = 'high';
  else if (score >= 4) urgency = 'medium';

  // 5. CATEGORY-SPECIFIC OVERRIDES
  if (detectedCategory === 'fire') {
    // Fire is almost never low urgency
    if (urgency === 'low') urgency = 'medium';
  }
  
  if (detectedCategory === 'medical' && score > 20) {
    urgency = 'high';
  }

  return { category: detectedCategory, urgency };
}

export function getActionSteps(category: EmergencyCategory, urgency: UrgencyLevel, problemText?: string): string[] {
  const text = problemText?.toLowerCase() || '';

  if (category === 'medical') {
    if (text.includes('heart') || text.includes('chest pain')) {
      return [
        'Call an ambulance immediately',
        'Have the person sit down, rest, and keep calm',
        'Loosen any tight clothing',
        'Ask if they take chest pain meds (e.g., nitroglycerin)',
        'If unconscious and not breathing, start CPR'
      ];
    }
    if (text.includes('stroke') || text.includes('face') || text.includes('slur')) {
      return [
        'Think FAST: Face drooping? Arm weakness? Speech difficulty? Call emergency!',
        'Note the time symptoms started',
        'Stay with the person until help arrives',
        'Do not give food or drink'
      ];
    }
    if (text.includes('bleed') || text.includes('blood') || text.includes('wound') || text.includes('stabbing')) {
      return [
        'Apply firm, direct pressure with a clean cloth',
        'Elevate the injury above heart level',
        'Do not remove blood-soaked cloths; add more on top',
        'If severe, consider a tourniquet if trained',
        'Keep the victim warm and stable'
      ];
    }
    if (text.includes('labor') || text.includes('pregnant') || text.includes('birth') || text.includes('contraction')) {
      return [
        'Call for medical help and track contraction frequency',
        'Help the mother find a comfortable position; stay calm',
        'Prepare clean towels and warm water',
        'Remind her to breathe deeply/slowly',
        'Support the baby as it emerges; do not pull'
      ];
    }
    if (text.includes('chok') || text.includes('cannot swallow') || text.includes('stuck in throat')) {
      return [
        'Perform the Heimlich maneuver (abdominal thrusts)',
        'For infants, use back blows and chest thrusts',
        'Call emergency services if the object is not dislodged',
        'If the person becomes unconscious, begin CPR'
      ];
    }
    if (text.includes('poison') || text.includes('toxic') || text.includes('swallow chemical')) {
      return [
        'Call Poison Control or emergency services immediately',
        'Identify what was swallowed and how much',
        'Do not induce vomiting unless told to do so by a professional',
        'If the person is unconscious, check for breathing'
      ];
    }
    if (text.includes('allergy') || text.includes('bee sting') || text.includes('anaphylaxis') || text.includes('swelling')) {
      return [
        'Use an epinephrine auto-injector (EpiPen) if available',
        'Call emergency services immediately',
        'Have the person lie still on their back',
        'Loosen tight clothing and cover with a blanket'
      ];
    }
    if (text.includes('seizure') || text.includes('fit') || text.includes('shaking')) {
      return [
        'Keep the person safe and protect their head',
        'Do not restrain them or put anything in their mouth',
        'Roll them onto their side once shaking stops',
        'Time the seizure; call help if it lasts > 5 minutes'
      ];
    }

    if (text.includes('burn') || text.includes('fire injury') || text.includes('scald')) {
      return [
        'Run cool (not cold) water over the burn for 10-20 minutes',
        'Remove jewelry or tight clothing before area swells',
        'Do not break blisters or apply butter/ointments',
        'Cover loosely with sterile dressing or plastic wrap',
        'Call emergency if burn is large, deep, or on face/hands'
      ];
    }
    if (text.includes('cold') || text.includes('hypothermia') || text.includes('shiver')) {
      return [
        'Move the person to a warm, dry place',
        'Remove wet clothing and wrap in blankets',
        'Give warm, sweet, non-alcoholic drinks if conscious',
        'Do not use direct heat (like hot water or lamps)',
        'Monitor breathing; call emergency help immediately'
      ];
    }
    if (text.includes('frostbite') || text.includes('numb') || text.includes('frozen')) {
      return [
        'Move to a warmer area; do not rub the affected area',
        'Soak in warm (not hot) water (approx 100-105°F)',
        'Loosely wrap with sterile dry dressing',
        'Keep frostbitten fingers/toes separated with gauze',
        'Seek professional medical attention immediately'
      ];
    }

    if (urgency === 'high') return ['Call ambulance immediately (911)', 'Check for breathing', 'Apply pressure to bleeding', 'Do not move patient unless necessary'];
    return ['Contact a doctor', 'Clean wounds if any', 'Monitor symptoms', 'Keep area elevated'];
  }

  switch (category) {
    case 'fire':
      return ['Evacuate building immediately', 'Call fire department', 'Stay low to avoid smoke', 'Close doors behind you to slow fire spread'];
    case 'police':
      if (urgency === 'high') return ['Stay in a safe location', 'Call police immediately', 'Do not confront attacker', 'Note descriptions of individuals'];
      return ['Report incident to nearest station', 'Keep evidence safe', 'Wait for police arrival'];
    case 'water':
      return [
        'Call 1916 to report the supply issue',
        'Check if the issue is local to your house or neighborhood',
        'In case of pipe burst, try to shut off the main valve if accessible',
        'Avoid using contaminated water for drinking or cooking'
      ];
    case 'electricity':
      return [
        'Call 1912 for power outage or electrical faults',
        'If a wire is down, stay at least 30 feet away and warn others',
        'Unplug sensitive electronic devices to avoid surge damage',
        'Do not touch anyone who is in contact with a live wire'
      ];
    case 'roads':
      return [
        'Report hazardous potholes or blockages to 1073',
        'Use the municipal portal to upload photos of the road damage',
        'Warn fellow travelers of severe hidden road hazards',
        'Avoid flooded roads or areas with precarious street furniture'
      ];
    case 'waste':
      return [
        'Report missed collection or illegal dumping to 1969',
        'Ensure wet and dry waste is segregated for collection',
        'Do not burn garbage; it releases toxic fumes',
        'Use the municipal app to file persistent waste disposal complaints'
      ];
    case 'crop':
      return ['Take clear photos of affected area', 'Isolate affected plants if possible', 'Consult local agricultural extension office', 'Check water and soil quality'];
    default:
      return ['Identify immediate danger', 'Contact relevant help', 'Inform emergency contacts', 'Stay in a safe, visible location'];
  }
}
