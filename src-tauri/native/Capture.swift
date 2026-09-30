import Foundation
import ScreenCaptureKit
import AVFoundation
import CoreMedia

// One process per meeting. No screen frames are written or transmitted.
@available(macOS 15.0, *)
final class Capture: NSObject, SCStreamOutput, SCStreamDelegate, @unchecked Sendable {
    let directory: URL
    let dual: Bool
    let queue = DispatchQueue(label: "com.glu.audio")
    var stream: SCStream?
    var files: [SCStreamOutputType: AVAudioFile] = [:]
    var origin: Double?
    var paused = false
    var pausedAt = 0.0
    var pauseDuration = 0.0
    var failure: String?
    init(directory: URL, dual: Bool) { self.directory = directory; self.dual = dual }
    func start() async throws {
        guard await AVCaptureDevice.requestAccess(for: .audio) else { throw NSError(domain: "Permite el micrófono en Ajustes del Sistema > Privacidad y seguridad.", code: 1) }
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard let display = content.displays.first else { throw NSError(domain: "No se encontró una pantalla para capturar audio.", code: 2) }
        let config = SCStreamConfiguration()
        config.width = 2; config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
        config.capturesAudio = dual
        config.excludesCurrentProcessAudio = true
        config.sampleRate = 48000; config.channelCount = 1
        config.captureMicrophone = true
        let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
        let capture = SCStream(filter: filter, configuration: config, delegate: self)
        try capture.addStreamOutput(self, type: .microphone, sampleHandlerQueue: queue)
        if dual { try capture.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue) }
        self.stream = capture
        try await capture.startCapture()
    }
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        queue.async { self.failure = error.localizedDescription }
        fputs("Captura interrumpida: \(error.localizedDescription)\n", stderr)
    }
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard !paused, sampleBuffer.isValid, type == .audio || type == .microphone,
              let description = sampleBuffer.formatDescription else { return }
        let format = AVAudioFormat(cmAudioFormatDescription: description)
        do {
            let count = CMSampleBufferGetNumSamples(sampleBuffer)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)) else { return }
            buffer.frameLength = AVAudioFrameCount(count)
            let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(sampleBuffer, at: 0, frameCount: Int32(count), into: buffer.mutableAudioBufferList)
            guard status == noErr else { throw NSError(domain: "No se pudo leer una muestra de audio.", code: Int(status)) }
            let timestamp = sampleBuffer.presentationTimeStamp.seconds
            if origin == nil { origin = timestamp }
            let elapsed = max(0, timestamp - origin! - pauseDuration)
            let file: AVAudioFile
            if let existing = files[type] { file = existing }
            else {
                file = try AVAudioFile(forWriting: directory.appendingPathComponent(type == .audio ? "system.caf" : "microphone.caf"), settings: format.settings)
                files[type] = file
            }
            // Pad dropped samples and route start offsets with silence; preserves common timing.
            let expected = AVAudioFramePosition(elapsed * format.sampleRate)
            var missing = expected - file.framePosition
            while missing > 0 {
                let frames = AVAudioFrameCount(min(missing, 4096))
                guard let silence = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { break }
                silence.frameLength = frames
                for audio in UnsafeMutableAudioBufferListPointer(silence.mutableAudioBufferList) {
                    if let ptr = audio.mData { memset(ptr, 0, Int(audio.mDataByteSize)) }
                }
                try file.write(from: silence); missing -= AVAudioFramePosition(frames)
            }
            try file.write(from: buffer)
        } catch { failure = error.localizedDescription }
    }
    func pause(_ value: Bool) { queue.sync {
        if value == paused { return }
        if value { pausedAt = ProcessInfo.processInfo.systemUptime }
        else { pauseDuration += ProcessInfo.processInfo.systemUptime - pausedAt }
        paused = value
    } }
    func stop() async throws {
        try await stream?.stopCapture()
        queue.sync { files.removeAll() }
        try merge()
        if let failure = failure { throw NSError(domain: failure, code: 3) }
    }
    func merge() throws {
        let inputs = try ["microphone.caf", "system.caf"].compactMap { name -> AVAudioFile? in
            let url = directory.appendingPathComponent(name)
            return FileManager.default.fileExists(atPath: url.path) ? try AVAudioFile(forReading: url) : nil
        }
        guard !inputs.isEmpty else { throw NSError(domain: "No se capturó audio.", code: 4) }
        let target = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
        let output = try AVAudioFile(forWriting: directory.appendingPathComponent("audio.wav"), settings: target.settings)
        let converters = inputs.map { AVAudioConverter(from: $0.processingFormat, to: target)! }
        var finished = Array(repeating: false, count: inputs.count)
        while !finished.allSatisfy({ $0 }) {
            let mixed = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: 4096)!
            mixed.frameLength = 4096
            memset(mixed.floatChannelData![0], 0, 4096 * MemoryLayout<Float>.size)
            var length: AVAudioFrameCount = 0
            for i in inputs.indices where !finished[i] {
                let converted = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: 4096)!
                var conversionError: NSError?
                let result = converters[i].convert(to: converted, error: &conversionError) { count, status in
                    let source = AVAudioPCMBuffer(pcmFormat: inputs[i].processingFormat, frameCapacity: count)!
                    do { try inputs[i].read(into: source) } catch { status.pointee = .endOfStream; return nil }
                    status.pointee = source.frameLength == 0 ? .endOfStream : .haveData
                    return source.frameLength == 0 ? nil : source
                }
                if let error = conversionError { throw error }
                if result == .endOfStream { finished[i] = true }
                length = max(length, converted.frameLength)
                if result == .error { throw NSError(domain: "No se pudo convertir el audio capturado.", code: 5) }
                for frame in 0..<Int(converted.frameLength) { mixed.floatChannelData![0][frame] += converted.floatChannelData![0][frame] / Float(inputs.count) }
            }
            if length > 0 { mixed.frameLength = length; try output.write(from: mixed) }
        }
    }
}
@main struct Recorder {
    static func main() async {
        guard #available(macOS 15.0, *) else { fputs("Glu requiere macOS 15 o posterior para captura nativa.\n", stderr); exit(1) }
        do {
            let capture = Capture(directory: URL(fileURLWithPath: CommandLine.arguments[1]), dual: CommandLine.arguments.contains("--dual"))
            if CommandLine.arguments.contains("--recover") { try capture.merge(); return }
            try await capture.start()
            print("READY"); fflush(stdout)
            // Read stdin off the main executor; ScreenCaptureKit uses the main run loop.
            await withCheckedContinuation { continuation in
                DispatchQueue.global().async {
                    while let line = readLine() {
                        if line == "pause" { capture.pause(true) }
                        else if line == "resume" { capture.pause(false) }
                        else if line == "stop" { break }
                    }
                    continuation.resume()
                }
            }
            try await capture.stop()
        } catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
    }
}
