// One-shot Swift CLI that re-encodes a ProRes 4444 (alpha-bearing) .mov
// into a HEVC-with-alpha .mov via AVAssetWriter, the same path Apple's
// Final Cut Pro and Compressor use. Output is the only HEVC-alpha
// encoding Safari/iOS reliably honors at small file sizes — ffmpeg's
// `hevc_videotoolbox -alpha_quality` is bug-ridden across recent
// ffmpeg builds on macOS and produces files Safari renders white.
//
// Usage: swift encode-hevc-alpha.swift <input.mov> <output.mov> [quality]
//   quality: 0.0..1.0, default 0.6 (small file, edge-clean alpha)

import AVFoundation
import Foundation
import VideoToolbox

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: \(args[0]) <input.mov> <output.mov> [quality 0..1]")
    exit(2)
}
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
let quality = args.count >= 4 ? (Double(args[3]) ?? 0.6) : 0.6

try? FileManager.default.removeItem(at: output)

let asset = AVURLAsset(url: input)
let semaphore = DispatchSemaphore(value: 0)
var loadError: Error?

Task {
    do {
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else {
            print("ERROR: no video track in \(input.path)"); exit(1)
        }
        let size = try await track.load(.naturalSize)
        let frameRate = try await track.load(.nominalFrameRate)
        let duration = try await asset.load(.duration)

        let writer = try AVAssetWriter(outputURL: output, fileType: .mov)
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.hevcWithAlpha,
            AVVideoWidthKey: Int(size.width),
            AVVideoHeightKey: Int(size.height),
            AVVideoCompressionPropertiesKey: [
                kVTCompressionPropertyKey_Quality as String: quality,
                kVTCompressionPropertyKey_TargetQualityForAlpha as String: quality,
            ],
        ]
        let writerInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        writerInput.expectsMediaDataInRealTime = false
        writer.add(writerInput)

        let reader = try AVAssetReader(asset: asset)
        let readerSettings: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
        ]
        let readerOutput = AVAssetReaderTrackOutput(track: track, outputSettings: readerSettings)
        reader.add(readerOutput)

        guard writer.startWriting() else {
            print("ERROR: writer failed to start: \(writer.error?.localizedDescription ?? "unknown")")
            exit(1)
        }
        writer.startSession(atSourceTime: .zero)
        reader.startReading()

        let queue = DispatchQueue(label: "encoder")
        writerInput.requestMediaDataWhenReady(on: queue) {
            while writerInput.isReadyForMoreMediaData {
                if let buffer = readerOutput.copyNextSampleBuffer() {
                    if !writerInput.append(buffer) {
                        print("ERROR: append failed: \(writer.error?.localizedDescription ?? "unknown")")
                        reader.cancelReading()
                        writer.cancelWriting()
                        exit(1)
                    }
                } else {
                    writerInput.markAsFinished()
                    writer.finishWriting {
                        if writer.status == .completed {
                            print("OK: \(output.lastPathComponent) (\(Int(duration.seconds * Double(frameRate))) frames)")
                        } else {
                            print("ERROR: writer ended in \(writer.status.rawValue): \(writer.error?.localizedDescription ?? "unknown")")
                        }
                        semaphore.signal()
                    }
                    return
                }
            }
        }
    } catch {
        loadError = error
        semaphore.signal()
    }
}

semaphore.wait()
if let err = loadError {
    print("ERROR: \(err)"); exit(1)
}
