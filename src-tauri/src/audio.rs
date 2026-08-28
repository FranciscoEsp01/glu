use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavSpec, WavWriter};
use std::sync::{Arc, Mutex};

pub struct AudioRecorder {
    writer: Arc<Mutex<Option<WavWriter<std::io::BufWriter<std::fs::File>>>>>,
    stream: Option<cpal::Stream>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            writer: Arc::new(Mutex::new(None)),
            stream: None,
        }
    }

    pub fn start_recording(&mut self, file_path: &str) -> Result<(), Box<dyn std::error::Error>> {
        let host = cpal::default_host();
        let device = host.default_input_device().ok_or("No se encontró dispositivo de entrada de audio")?;
        let config = device.default_input_config()?;

        let spec = WavSpec {
            channels: config.channels(),
            sample_rate: config.sample_rate().0,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let writer = WavWriter::create(file_path, spec)?;
        *self.writer.lock().unwrap() = Some(writer);

        let writer_clone = Arc::clone(&self.writer);
        let stream = device.build_input_stream(
            &config.into(),
            move |data: &[i16], _: &_| {
                if let Ok(mut guard) = writer_clone.lock() {
                    if let Some(ref mut w) = *guard {
                        for &sample in data {
                            let _ = w.write_sample(sample);
                        }
                    }
                }
            },
            move |err| eprintln!("Audio error: {}", err),
            None,
        )?;

        stream.play()?;
        self.stream = Some(stream);

        Ok(())
    }

    pub fn stop_recording(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.stream = None;
        if let Ok(mut guard) = self.writer.lock() {
            if let Some(w) = guard.take() {
                w.finalize()?;
            }
        }
        Ok(())
    }
}
