/**
 * main.js — Entry point for the landing page (index.html).
 */
import '../../css/main.css';
import { initIntro } from '../intro.js';
import { initDepartments } from '../departments.js';

initIntro();
initDepartments();

try {
  document.documentElement.appendChild(document.createComment(' #TECHNOBLADENEVERDIES '));
} catch (_) {}
