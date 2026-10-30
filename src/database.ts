import { getFirestore } from "firebase/firestore";
import { app } from "./firebase";
import config from "../firebase-applet-config.json";
export const db = getFirestore(app, config.firestoreDatabaseId);
