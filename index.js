import { MFAApi, Configuration } from 'bandwidth-sdk';
import readline from 'readline';

const BW_ACCOUNT_ID = process.env.BW_ACCOUNT_ID;
const BW_CLIENT_ID = process.env.BW_CLIENT_ID;
const BW_CLIENT_SECRET = process.env.BW_CLIENT_SECRET;
const BW_NUMBER = process.env.BW_NUMBER;
const BW_VOICE_APPLICATION_ID = process.env.BW_VOICE_APPLICATION_ID;
const BW_MESSAGING_APPLICATION_ID = process.env.BW_MESSAGING_APPLICATION_ID;

if([
    BW_ACCOUNT_ID,
    BW_CLIENT_ID,
    BW_CLIENT_SECRET,
    BW_NUMBER,
    BW_VOICE_APPLICATION_ID,
    BW_MESSAGING_APPLICATION_ID
].some(item => item === undefined)) {
    throw new Error('Please set the environment variables defined in the README');
}

const config = new Configuration({
    clientId: BW_CLIENT_ID,
    clientSecret: BW_CLIENT_SECRET
});

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const SCOPE = 'sample';

const lines = readline.createInterface({ input: process.stdin })[Symbol.asyncIterator]();

const prompt = async (text) => {
    process.stdout.write(text);
    const { value, done } = await lines.next();
    if (done) {
        process.exit(1);
    }
    return value.trim();
};

const main = async () => {
    const phoneNumber = await prompt('Enter the phone number to send the code to (E.164, e.g. +15554443333): ');
    if (!E164_PATTERN.test(phoneNumber)) {
        console.error('Phone number must be in E.164 format, e.g. +15554443333');
        process.exit(1);
    }

    const method = (await prompt('Send the code by messaging or voice? [messaging]: ')).toLowerCase() || 'messaging';
    if (method !== 'messaging' && method !== 'voice') {
        console.error('Method must be messaging or voice');
        process.exit(1);
    }

    const mfaApi = new MFAApi(config);

    const codeRequest = {
        to: phoneNumber,
        from: BW_NUMBER,
        applicationId: method === 'voice' ? BW_VOICE_APPLICATION_ID : BW_MESSAGING_APPLICATION_ID,
        scope: SCOPE,
        message: 'Your temporary {NAME} {SCOPE} code is {CODE}',
        digits: 6
    };

    console.log(`Sending a code by ${method} to ${phoneNumber}`);
    try {
        if (method === 'voice') {
            await mfaApi.generateVoiceCode(BW_ACCOUNT_ID, codeRequest);
        } else {
            await mfaApi.generateMessagingCode(BW_ACCOUNT_ID, codeRequest);
        }
    } catch (err) {
        console.error('Failed to send code:', err.message);
        process.exit(1);
    }

    const verifyRequest = {
        to: phoneNumber,
        scope: SCOPE,
        expirationTimeInMinutes: 3,
        code: await prompt('Enter the code you received: ')
    };

    let valid;
    try {
        const { data } = await mfaApi.verifyCode(BW_ACCOUNT_ID, verifyRequest);
        valid = data.valid;
    } catch (err) {
        console.error('Failed to verify code:', err.message);
        process.exit(1);
    }

    console.log(valid ? 'Code verified' : 'Code not verified');
    process.exit(valid ? 0 : 1);
};

main();
