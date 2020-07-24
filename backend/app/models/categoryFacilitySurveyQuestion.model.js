module.exports = function CategoryFacilitySurveyQuestion(sequelize) {
    var Sequelize = sequelize.constructor;
    // var district = require('./district.model') (sequelize);
    var facilitySurveyQuestion = require('./facilitySurveyQuestion.model') (sequelize);
    var category = require('./category.model') (sequelize);
    var ret =
      sequelize.define('categoryFacilitySurveyQuestion', {
        parent_cat_id: {
          type: Sequelize.INTEGER
        },
        child_cat_id: {
          type: Sequelize.INTEGER
        },
        facility_survey_question_id: {
          type: Sequelize.INTEGER
        },
        sort_order: {
            type: Sequelize.INTEGER
        },
        status: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
        modified_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
  
      }, {
        tableName: 'category_facility_survey_question',
        timestamps: false
  
      });
      ret.belongsTo(category, {foreignKey: 'parent_cat_id',as: 'parent_cat'});
      ret.belongsTo(category, {foreignKey: 'child_cat_id',as: 'child_cat'});
      ret.belongsTo(facilitySurveyQuestion, {foreignKey: 'facility_survey_question_id'});
    //   ret.relations = {
    //     lsgiType:lsgiType,
    //     lsgiBlock:lsgiBlock
    // };
    //   ret.belongsTo(lsgiType, {foreignKey: 'lsgi_type_id'});
    //   // lsgiType.hasMany(ret, {foreignKey: 'lsgi_type_id'});
    //   ret.belongsTo(lsgiBlock, {foreignKey: 'lsgi_block_id'});
  
    return ret;
  }
  