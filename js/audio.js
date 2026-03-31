/**
 * audio.js - Web Speech API を使った音声再生機能
 */

const AudioManager = (() => {
    const synth = window.speechSynthesis;

    function play(text, lang = 'en-US') {
        if (!text) return;
        
        // 再生中の音声を停止
        if (synth.speaking) {
            synth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9; // 少しゆっくりめに再生
        
        // 利用可能な音声から最適なものを選択（オプション）
        const voices = synth.getVoices();
        const enVoice = voices.find(v => v.lang === lang && v.name.includes('Google')) || 
                        voices.find(v => v.lang === lang);
        if (enVoice) {
            utterance.voice = enVoice;
        }

        synth.speak(utterance);
    }

    return {
        play
    };
})();
