/**
 * QR Code Parser for Vietnamese ID Cards
 * 
 * Parses QR payload from Vietnamese national ID cards and extracts client information.
 * Format: id_card_num|health_insurance_num|name|DDMMYYYY|gender|
 * Example: 086094006827|331757192|NGUYỄN THIỆN CHÍ|21091994|Nam|
 */

export interface ParsedQRData {
    id_card_num: string;
    name: string;
    date_of_birth: Date; // Converted from DDMMYYYY
    gender: 'Nam' | 'Nữ' | 'Khác';
}

export class QRParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QRParseError';
    }
}

const ALLOWED_GENDERS = ['Nam', 'Nữ', 'Khác'] as const;

/**
 * Parse Vietnamese ID card QR code payload
 * 
 * @param qrPayload - Raw QR code string (pipe-delimited)
 * @returns Parsed client data
 * @throws QRParseError if payload is invalid
 * 
 * @example
 * ```typescript
 * const data = parseIDCardQR('086094006827|331757192|NGUYỄN THIỆN CHÍ|21091994|Nam|');
 * // Returns:
 * // {
 * //   id_card_num: '086094006827',
 * //   name: 'NGUYỄN THIỆN CHÍ',
 * //   date_of_birth: Date('1994-09-21'),
 * //   gender: 'Nam'
 * // }
 * ```
 */
export function parseIDCardQR(qrPayload: string): ParsedQRData {
    // Step 1: Split by pipe delimiter
    const segments = qrPayload.split('|');

    // Step 2: Validate segment count (must have at least 5 segments)
    if (segments.length < 5) {
        throw new QRParseError(
            `Invalid QR format: expected at least 5 segments, got ${segments.length}`
        );
    }

    // Step 3: Extract fields
    // Segment 0: ID card number
    // Segment 1: Health insurance (IGNORED)
    // Segment 2: Full name
    // Segment 3: Date of birth (DDMMYYYY)
    // Segment 4: Gender

    const id_card_num = segments[0]?.trim();
    const name = segments[2]?.trim();
    const birthdateStr = segments[3]?.trim();
    const gender = segments[4]?.trim();

    // Step 4: Validate required fields are non-empty
    if (!id_card_num) {
        throw new QRParseError('ID card number is missing');
    }

    if (!name) {
        throw new QRParseError('Name is missing');
    }

    if (!birthdateStr) {
        throw new QRParseError('Date of birth is missing');
    }

    if (!gender) {
        throw new QRParseError('Gender is missing');
    }

    // Step 5: Parse date from DDMMYYYY format
    const date_of_birth = parseDDMMYYYY(birthdateStr);

    // Step 6: Validate gender
    if (!ALLOWED_GENDERS.includes(gender as any)) {
        throw new QRParseError(
            `Invalid gender: "${gender}". Must be one of: ${ALLOWED_GENDERS.join(', ')}`
        );
    }

    return {
        id_card_num,
        name,
        date_of_birth,
        gender: gender as 'Nam' | 'Nữ' | 'Khác',
    };
}

/**
 * Convert DDMMYYYY string to Date object
 * 
 * @param dateStr - 8-digit date string (e.g., "21091994")
 * @returns Date object
 * @throws QRParseError if format is invalid
 * 
 * @example
 * ```typescript
 * parseDDMMYYYY('21091994') // Date('1994-09-21')
 * ```
 */
function parseDDMMYYYY(dateStr: string): Date {
    // Validate length
    if (dateStr.length !== 8) {
        throw new QRParseError(
            `Invalid date format: expected 8 digits (DDMMYYYY), got ${dateStr.length} characters`
        );
    }

    // Validate all characters are digits
    if (!/^\d{8}$/.test(dateStr)) {
        throw new QRParseError(
            `Invalid date format: must contain only digits, got "${dateStr}"`
        );
    }

    // Extract components
    const day = dateStr.slice(0, 2);
    const month = dateStr.slice(2, 4);
    const year = dateStr.slice(4, 8);

    // Build ISO date string (YYYY-MM-DD)
    const isoDate = `${year}-${month}-${day}`;

    // Create Date object
    const dateObj = new Date(isoDate);

    // Validate date is valid (handles things like Feb 31st)
    if (isNaN(dateObj.getTime())) {
        throw new QRParseError(
            `Invalid date: ${day}/${month}/${year} is not a valid calendar date`
        );
    }

    // Additional validation: ensure parsed date matches input
    // (JavaScript Date can silently adjust invalid dates like "2023-02-31" -> "2023-03-03")
    const parsedDay = dateObj.getUTCDate().toString().padStart(2, '0');
    const parsedMonth = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
    const parsedYear = dateObj.getUTCFullYear().toString();

    if (parsedDay !== day || parsedMonth !== month || parsedYear !== year) {
        throw new QRParseError(
            `Invalid date: ${day}/${month}/${year} was adjusted to ${parsedDay}/${parsedMonth}/${parsedYear}`
        );
    }

    // Validate year is in reasonable range (1900-2100)
    const yearNum = parseInt(year, 10);
    if (yearNum < 1900 || yearNum > 2100) {
        throw new QRParseError(
            `Invalid year: ${year} is outside acceptable range (1900-2100)`
        );
    }

    return dateObj;
}

// Example usage and test cases
if (require.main === module) {
    console.log('Testing QR Parser...\n');

    // Test 1: Valid QR payload
    try {
        const result = parseIDCardQR('086094006827|331757192|NGUYỄN THIỆN CHÍ|21091994|Nam|');
        console.log('✅ Test 1 PASSED: Valid QR payload');
        console.log('   Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.log('❌ Test 1 FAILED:', (error as Error).message);
    }

    // Test 2: Invalid date (Feb 31st)
    try {
        parseIDCardQR('086094006827|331757192|NGUYỄN THIỆN CHÍ|31021994|Nam|');
        console.log('❌ Test 2 FAILED: Should have rejected invalid date');
    } catch (error) {
        console.log('✅ Test 2 PASSED: Rejected invalid date (Feb 31st)');
    }

    // Test 3: Invalid gender
    try {
        parseIDCardQR('086094006827|331757192|NGUYỄN THIỆN CHÍ|21091994|Male|');
        console.log('❌ Test 3 FAILED: Should have rejected invalid gender');
    } catch (error) {
        console.log('✅ Test 3 PASSED: Rejected invalid gender');
    }

    // Test 4: Missing segments
    try {
        parseIDCardQR('086094006827|331757192|NGUYỄN THIỆN CHÍ');
        console.log('❌ Test 4 FAILED: Should have rejected incomplete payload');
    } catch (error) {
        console.log('✅ Test 4 PASSED: Rejected incomplete payload');
    }

    // Test 5: Invalid date format (7 digits)
    try {
        parseIDCardQR('086094006827|331757192|NGUYỄN THIỆN CHÍ|2109199|Nam|');
        console.log('❌ Test 5 FAILED: Should have rejected invalid date format');
    } catch (error) {
        console.log('✅ Test 5 PASSED: Rejected invalid date format');
    }
}
