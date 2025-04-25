import {StyleSheet, Text, View} from 'react-native';
import React, {useEffect, useRef, useState} from 'react';
import {
  useCameraDevice,
  useFrameProcessor,
  Camera as VisionCamera,
} from 'react-native-vision-camera';
import {
  useFaceDetector,
  Face,
  FaceDetectionOptions,
} from 'react-native-vision-camera-face-detector';
import {useRunOnJS} from 'react-native-worklets-core';

export default function App() {
  const device = useCameraDevice('front');
  const [detectedFaces, setDetectedFaces] = useState<Face[]>([]);
  const [livenessStatus, setLivenessStatus] = useState('Checking...');
  const [recognitionResult, setRecognitionResult] = useState('Searching...');

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    classificationMode: 'all',
    contourMode: 'all',
    performanceMode: 'accurate',
  }).current;

  const {detectFaces} = useFaceDetector(faceDetectionOptions);

  useEffect(() => {
    (async () => {
      const status = await VisionCamera.requestCameraPermission();
      console.log({status});
    })();
  }, [device]);

  // Update states on the main JS thread
  const handleDetectedFaces = useRunOnJS((faces: Face[]) => {
    setDetectedFaces(faces);
  }, []);

  const handleLivenessStatusUpdate = useRunOnJS((status: string) => {
    setLivenessStatus(status);
  }, []);

  const handleRecognitionResultUpdate = useRunOnJS((result: string) => {
    setRecognitionResult(result);
  }, []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet'; // Mark the function as a worklet

      // Detect faces
      const faces = detectFaces(frame);
      if (faces.length > 0) {
        console.log({faces: faces[0].leftEyeOpenProbability});

        // Update detected faces state on the JS thread
        handleDetectedFaces(faces);

        // Integrate liveness and recognition checks here
        const isLive = Math.random() > 0.5; // Placeholder logic for liveness check
        handleLivenessStatusUpdate(
          isLive ? 'Liveness Passed' : 'Liveness Failed',
        );

        if (isLive) {
          // Facial recognition (replace with actual recognition logic)
          const recognizedUser = faces[0].identity ? faces[0].identity : null;
          handleRecognitionResultUpdate(
            recognizedUser
              ? `Recognized: ${recognizedUser}`
              : 'Face not recognized',
          );
        }
      } else {
        // Reset if no faces are detected
        handleDetectedFaces([]);
        handleLivenessStatusUpdate('Checking...');
        handleRecognitionResultUpdate('Searching...');
      }
    },
    [
      handleDetectedFaces,
      handleLivenessStatusUpdate,
      handleRecognitionResultUpdate,
      detectFaces,
    ],
  );

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>No Camera Device Found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VisionCamera
        isActive
        style={StyleSheet.absoluteFill}
        device={device}
        frameProcessor={frameProcessor}
      />

      {/* Overlay for displaying detected faces and status */}
      <View style={styles.overlay}>
        <Text style={styles.statusText}>{livenessStatus}</Text>
        <Text style={styles.statusText}>{recognitionResult}</Text>
        <Text style={styles.statusText}>
          Detected Faces: {detectedFaces.length}
        </Text>
        <Text style={styles.statusText}>
          is Left Eye Open:{' '}
          {detectedFaces?.[0]?.leftEyeOpenProbability <= 0.9498605728149414
            ? 'No'
            : 'Yes'}
        </Text>

        {/* Render bounding boxes for faces */}
        {detectedFaces.map((face, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: face.bounds.x,
              top: face.bounds.y,
              width: face.bounds.width,
              height: face.bounds.height,
              borderColor: 'green',
              borderWidth: 2,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 5,
  },
});
