const adminService = require('./admin.service');

/**
 * Platform Admin Controller
 */

async function getAllLibraries(req, res, next) {
  try {
    const libraries = await adminService.listAllLibraries();
    res.status(200).json({
      message: 'All platform libraries retrieved successfully.',
      count: libraries.length,
      libraries,
    });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await adminService.updateLibraryStatus(id, status);
    res.status(200).json({
      message: `Library status updated to ${updated.status}.`,
      library: updated,
    });
  } catch (err) {
    next(err);
  }
}

async function removeLibrary(req, res, next) {
  try {
    const { id } = req.params;
    const result = await adminService.deleteLibrary(id);
    res.status(200).json({
      message: `Library "${result.libraryName}" (ID: ${result.deletedLibraryId}) has been completely removed from the platform.`,
      result,
    });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await adminService.getPlatformStats();
    res.status(200).json({
      message: 'Platform statistics retrieved successfully.',
      stats,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllLibraries,
  updateStatus,
  removeLibrary,
  getStats,
};
