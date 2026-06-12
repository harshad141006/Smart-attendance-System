import cv2
from face_mesh_detector import FaceMeshDetector


def main():
    cap = cv2.VideoCapture(0)
    detector = FaceMeshDetector()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        analysis = detector.analyze(frame)
        if analysis is None:
            cv2.putText(frame, 'No face', (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        else:
            blink = analysis['blink']
            gaze = analysis['gaze']
            head = analysis['head']
            status = f"Blink: {blink['blink']} | Gaze: {gaze.get('gaze', 'unknown')}"
            if head.get('valid'):
                status += f" | Yaw:{head['yaw']:.1f} Pitch:{head['pitch']:.1f} Roll:{head['roll']:.1f}"
            cv2.putText(frame, status, (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        cv2.imshow('Face Mesh Demo', frame)
        key = cv2.waitKey(1) & 0xFF
        if key == 27 or key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == '__main__':
    main()
